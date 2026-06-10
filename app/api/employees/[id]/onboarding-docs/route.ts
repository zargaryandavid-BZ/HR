import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { logDocumentAudit } from "@/lib/documents/service";

const assignSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Manually assign repository documents to an employee (unsent until HR sends) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const activeDocs = await prisma.sop.findMany({
      where: {
        id: { in: parsed.data.documentIds },
        isActive: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const validIds = new Set(activeDocs.map((doc) => doc.id));

    let assigned = 0;
    let skipped = 0;

    for (const documentId of parsed.data.documentIds) {
      if (!validIds.has(documentId)) {
        skipped++;
        continue;
      }

      const existing = await prisma.documentAssignment.findUnique({
        where: {
          sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.documentAssignment.create({
        data: {
          sopId: documentId,
          employeeId,
          assignedById: session.id,
          assignedManually: true,
          isOffboarding: false,
          sentAt: null,
        },
      });

      await logDocumentAudit({
        userId: session.id,
        action: "DOCUMENT_MANUALLY_ASSIGNED",
        targetId: documentId,
        targetTable: "DocumentAssignment",
        newValue: { employeeId, documentId, assignedById: session.id },
      });

      assigned++;
    }

    return Response.json(apiSuccess({ assigned, skipped }));
  } catch (error) {
    console.error("Assign onboarding docs error:", error);
    return apiError("Server error", "Failed to assign documents", 500);
  }
}

/** Remove an onboarding document assignment from an employee */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const documentId = request.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return apiError("Validation failed", "documentId is required");
    }

    const assignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
      },
      select: {
        id: true,
        assignedManually: true,
        sentAt: true,
        signedFileUrl: true,
        hrApprovedAt: true,
      },
    });

    if (!assignment) {
      return apiError("Not found", "Assignment not found", 404);
    }

    await prisma.documentAssignment.delete({ where: { id: assignment.id } });

    await logDocumentAudit({
      userId: session.id,
      action: "ONBOARDING_DOC_REMOVED",
      targetId: documentId,
      targetTable: "DocumentAssignment",
      oldValue: {
        employeeId,
        documentId,
        assignedManually: assignment.assignedManually,
        sentAt: assignment.sentAt?.toISOString() ?? null,
        hadSignedFile: !!assignment.signedFileUrl,
        hrApproved: !!assignment.hrApprovedAt,
      },
    });

    return Response.json(apiSuccess(null, "Document removed"));
  } catch (error) {
    console.error("Remove onboarding doc error:", error);
    return apiError("Server error", "Failed to remove document", 500);
  }
}
