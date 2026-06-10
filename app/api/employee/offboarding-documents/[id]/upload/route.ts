import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { offboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { uploadSignedDocument } from "@/lib/documents/storage";
import { notifyHrAdminsDocumentAwaitingApproval } from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string }> };

/** Employee uploads their signed copy of an offboarding document */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: documentId } = await params;

    const sop = await prisma.sop.findFirst({
      where: { id: documentId, isActive: true, status: "ACTIVE" },
      select: { id: true, version: true, uploadedById: true, title: true },
    });
    if (!sop) return apiError("Not found", "Document not found", 404);

    const assignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: offboardingAssignmentKey(
          documentId,
          session.employeeId
        ),
      },
      select: { offboardingSentAt: true },
    });

    if (!assignment?.offboardingSentAt) {
      return apiError("Forbidden", "This document has not been sent to you yet");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return apiError("Validation failed", "File required");
    if (file.size > 10 * 1024 * 1024) return apiError("Validation failed", "Max 10 MB");

    const uploaded = await uploadSignedDocument(session.employeeId, documentId, file);
    if (!uploaded) return apiError("Validation failed", "File must be PDF, JPG, or PNG");

    const now = new Date();
    await prisma.$transaction([
      prisma.documentAssignment.update({
        where: {
          sopId_employeeId_isOffboarding: offboardingAssignmentKey(
            documentId,
            session.employeeId
          ),
        },
        data: {
          signedFileUrl: uploaded.url,
          signedAt: now,
          acknowledgedAt: now,
        },
      }),
      prisma.sopAcknowledgment.upsert({
        where: {
          sopId_employeeId_sopVersion: {
            sopId: documentId,
            employeeId: session.employeeId,
            sopVersion: sop.version,
          },
        },
        create: {
          sopId: documentId,
          employeeId: session.employeeId,
          sopVersion: sop.version,
          acknowledgedAt: now,
        },
        update: { acknowledgedAt: now },
      }),
    ]);

    await notifyHrAdminsDocumentAwaitingApproval({
      employeeId: session.employeeId,
      documentId,
      documentTitle: sop.title,
    });

    return Response.json(apiSuccess({ signedFileUrl: uploaded.url }, "Document uploaded successfully ✓"));
  } catch (error) {
    console.error("Employee offboarding document upload error:", error);
    return apiError("Server error", "Upload failed", 500);
  }
}
