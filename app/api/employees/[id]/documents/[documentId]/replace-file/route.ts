import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import {
  deleteSignedDocumentByUrl,
  uploadSignedDocument,
} from "@/lib/documents/storage";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

function storageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** HR replaces the signed file — resets signing status so employee must re-sign */
async function handleReplaceFile(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    if (!storageConfigured()) {
      return apiError(
        "Storage unavailable",
        "File storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
        503
      );
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
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      return apiError("Validation failed", "File is required");
    }
    if (fileEntry.size > 10 * 1024 * 1024) {
      return apiError("Validation failed", "File must be under 10 MB");
    }

    const existingAssignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
      },
      select: { id: true, signedFileUrl: true, signedAt: true, hrApprovedAt: true },
    });

    const uploaded = await uploadSignedDocument(employeeId, documentId, fileEntry);
    if (!uploaded) {
      return apiError(
        "Upload failed",
        "Could not upload file. Use PDF, JPG, or PNG under 10 MB and verify Supabase storage is configured.",
        503
      );
    }

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

    if (
      existingAssignment?.signedFileUrl &&
      existingAssignment.signedFileUrl !== uploaded.url
    ) {
      await deleteSignedDocumentByUrl(existingAssignment.signedFileUrl).catch(() => null);
    }

    const previousStatus = existingAssignment?.hrApprovedAt
      ? "HRApproved"
      : existingAssignment?.signedAt
        ? "Signed"
        : "NotStarted";

    try {
      await Promise.all([
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
            previousStatus,
            newStatus: "SignatureRequired",
          },
        }),
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
    } catch (sideEffectError) {
      console.error("Replace file side-effect error:", sideEffectError);
    }

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
  } catch (error) {
    console.error("Replace file error:", error);
    return apiError("Server error", "Failed to replace file", 500);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteParams) {
  return handleReplaceFile(request, ctx);
}

export async function POST(request: NextRequest, ctx: RouteParams) {
  return handleReplaceFile(request, ctx);
}
