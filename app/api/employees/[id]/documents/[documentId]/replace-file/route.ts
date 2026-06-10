import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { uploadSignedDocument } from "@/lib/documents/storage";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

/** HR replaces the signed file — resets signing status so employee must re-sign */
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return apiError("Validation failed", "File is required");
    }
    if (file.size > 10 * 1024 * 1024) {
      return apiError("Validation failed", "File must be under 10 MB");
    }

    const uploaded = await uploadSignedDocument(employeeId, documentId, file);
    if (!uploaded) {
      return apiError("Validation failed", "File must be PDF, JPG, or PNG");
    }

    // Save new file URL, reset signedAt + hrApprovedAt so status becomes "signature_required"
    const assignment = await prisma.documentAssignment.upsert({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
      },
      create: {
        sopId: documentId,
        employeeId,
        assignedById: session.id,
        isOffboarding: false,
        signedFileUrl: uploaded.url,
        signedAt: null,
        hrApprovedAt: null,
        hrApprovedBy: null,
        acknowledgedAt: null,
      },
      update: {
        signedFileUrl: uploaded.url,
        signedAt: null,
        hrApprovedAt: null,
        hrApprovedBy: null,
        acknowledgedAt: null,
      },
    });

    await Promise.all([
      // Audit log
      logIndividualSettingsAudit({
        userId: session.id,
        action: "DOCUMENT_FILE_REPLACED",
        targetId: employeeId,
        targetTable: "DocumentAssignment",
        newValue: {
          employeeId,
          documentId,
          fileName: uploaded.fileName,
          performedBy: session.id,
          previousStatus: "Signed",
          newStatus: "SignatureRequired",
        },
      }),
      // Notify the employee to re-sign
      prisma.notification.create({
        data: {
          employeeId,
          eventType: "DOCUMENT_UPDATED",
          channel: "IN_APP",
          status: "SENT",
          sentAt: new Date(),
          contentSnapshot: {
            message: `The ${sop.title} has been updated. Please download and sign the new version.`,
            href: "/employee/dashboard",
          },
        },
      }),
    ]);

    return Response.json(
      apiSuccess(
        {
          signedFileUrl: assignment.signedFileUrl,
          signedAt: null,
          hrApprovedAt: null,
          status: "signature_required",
        },
        "File replaced — employee must re-sign"
      )
    );
  } catch {
    return apiError("Server error", "Failed to replace file", 500);
  }
}
