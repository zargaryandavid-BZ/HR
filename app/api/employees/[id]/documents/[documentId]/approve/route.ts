import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { deleteSignedDocumentByUrl } from "@/lib/documents/storage";
import {
  onboardingAssignmentKey,
  offboardingAssignmentKey,
} from "@/lib/documents/assignment-keys";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

function assignmentKey(
  documentId: string,
  employeeId: string,
  isOffboarding: boolean
) {
  return isOffboarding
    ? offboardingAssignmentKey(documentId, employeeId)
    : onboardingAssignmentKey(documentId, employeeId);
}

const approveSchema = z.object({
  approved: z.boolean(),
  isOffboarding: z.boolean().optional().default(false),
});

/** HR manually approves or removes approval for an employee document */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, documentId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const sop = await prisma.sop.findFirst({
      where: { id: documentId, isActive: true },
      select: { id: true, title: true },
    });
    if (!sop) return apiError("Not found", "Document not found", 404);

    const body = await request.json();
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const isOffboarding = parsed.data.isOffboarding;
    const key = assignmentKey(documentId, employeeId, isOffboarding);

    // ── Remove approval: clear all signing fields → status becomes "not_started" ──
    if (!parsed.data.approved) {
      const existing = await prisma.documentAssignment.findUnique({
        where: { sopId_employeeId_isOffboarding: key },
      });

      if (!existing) {
        return Response.json(apiSuccess({ status: "not_started" }, "Already not approved"));
      }

      // Optionally remove the old signed file from storage
      if (existing.signedFileUrl) {
        await deleteSignedDocumentByUrl(existing.signedFileUrl).catch(() => null);
      }

      // Remove assignment so status resolves to "not_started" (not "downloaded")
      await prisma.documentAssignment.delete({ where: { id: existing.id } });

      await Promise.all([
        logIndividualSettingsAudit({
          userId: session.id,
          action: "DOCUMENT_APPROVAL_REMOVED",
          targetId: employeeId,
          targetTable: "DocumentAssignment",
          newValue: {
            employeeId,
            documentId,
            performedBy: session.id,
            previousStatus: "HRApproved",
            newStatus: "NotStarted",
          },
        }),
        // Notify the employee that they need to re-sign
        prisma.notification.create({
          data: {
            employeeId,
            eventType: "DOCUMENT_SIGNATURE_RESET",
            channel: "IN_APP",
            status: "SENT",
            sentAt: new Date(),
            contentSnapshot: {
              message: `Your ${sop.title} signature has been reset. Please download and re-sign the document.`,
              href: "/employee/dashboard",
            },
          },
        }),
      ]);

      return Response.json(
        apiSuccess(
          { hrApprovedAt: null, hrApprovedBy: null, signedFileUrl: null, status: "not_started" },
          "Approval removed — employee must re-sign"
        )
      );
    }

    // ── Grant approval ──
    const now = new Date();
    const existing = await prisma.documentAssignment.findUnique({
      where: { sopId_employeeId_isOffboarding: key },
      select: { sentAt: true, offboardingSentAt: true },
    });

    const assignment = await prisma.documentAssignment.upsert({
      where: { sopId_employeeId_isOffboarding: key },
      create: {
        sopId: documentId,
        employeeId,
        assignedById: session.id,
        isOffboarding,
        ...(isOffboarding
          ? { offboardingSentAt: now }
          : { sentAt: now }),
        hrApprovedAt: now,
        hrApprovedBy: session.id,
      },
      update: {
        hrApprovedAt: now,
        hrApprovedBy: session.id,
        ...(isOffboarding
          ? existing?.offboardingSentAt
            ? {}
            : { offboardingSentAt: now }
          : existing?.sentAt
            ? {}
            : { sentAt: now }),
      },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "DOCUMENT_HR_APPROVED",
      targetId: employeeId,
      targetTable: "DocumentAssignment",
      newValue: { employeeId, documentId, performedBy: session.id },
    });

    return Response.json(
      apiSuccess(
        {
          hrApprovedAt: assignment.hrApprovedAt?.toISOString() ?? null,
          hrApprovedBy: assignment.hrApprovedBy ?? null,
        },
        "Document approved"
      )
    );
  } catch {
    return apiError("Server error", "Failed to update approval", 500);
  }
}
