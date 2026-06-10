import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { uploadSignedDocument } from "@/lib/documents/storage";
import { completeOnboardingStep } from "@/lib/onboarding/service";
import { logDocumentAudit } from "@/lib/documents/service";
import type { DocumentSignStepConfig } from "@/lib/onboarding/types";

type RouteParams = { params: Promise<{ id: string; stepId: string }> };

const MAX_SIZE_MB = 10;

/** Upload a signed copy for a DOCUMENT_SIGN onboarding step */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const { id, stepId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("Validation failed", "File is required");
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return apiError("Validation failed", `File must be ${MAX_SIZE_MB}MB or less`);
    }

    const instance = await prisma.onboardingInstance.findUnique({
      where: { id },
      include: {
        stepProgress: {
          where: { stepId },
          include: { step: true },
        },
      },
    });

    if (!instance || instance.employeeId !== session.employeeId) {
      return apiError("Not found", "Onboarding not found", 404);
    }

    const progress = instance.stepProgress[0];
    if (!progress || progress.status === "LOCKED" || progress.status === "COMPLETED") {
      return apiError("Invalid", "Step is not available");
    }

    if (progress.step.stepType !== "DOCUMENT_SIGN") {
      return apiError("Invalid", "Step is not a document sign step");
    }

    const config = progress.step.config as DocumentSignStepConfig;
    const documentId = config.documentId;

    if (!documentId) {
      return apiError("Invalid", "Step has no linked document");
    }

    const document = await prisma.sop.findUnique({ where: { id: documentId } });
    if (!document) {
      return apiError("Not found", "Document not found", 404);
    }

    const uploaded = await uploadSignedDocument(session.employeeId, documentId, file);
    if (!uploaded) {
      return apiError("Validation failed", "File must be PDF, JPG, JPEG, or PNG");
    }

    const now = new Date();
    const responseData = {
      documentId,
      documentTitle: document.title,
      documentVersion: document.version,
      signedFileUrl: uploaded.url,
      uploadedFileUrl: uploaded.url,
      fileName: uploaded.fileName,
      filePath: uploaded.path,
      signedAt: now.toISOString(),
      acknowledgedAt: now.toISOString(),
    };

    // Update DocumentAssignment if one exists for this employee
    const { onboardingAssignmentKey } = await import("@/lib/documents/assignment-keys");
    const assignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(
          documentId,
          session.employeeId
        ),
      },
    });

    if (assignment) {
      await prisma.documentAssignment.update({
        where: { id: assignment.id },
        data: {
          signedFileUrl: uploaded.url,
          signedAt: now,
          ...(assignment.sentAt ? {} : { sentAt: now }),
        },
      });

      await prisma.sopAcknowledgment.upsert({
        where: {
          sopId_employeeId_sopVersion: {
            sopId: documentId,
            employeeId: session.employeeId,
            sopVersion: document.version,
          },
        },
        create: {
          sopId: documentId,
          employeeId: session.employeeId,
          sopVersion: document.version,
          acknowledgedAt: now,
        },
        update: { acknowledgedAt: now },
      });
    }

    const updated = await completeOnboardingStep(
      id,
      stepId,
      responseData,
      session.employeeId
    );

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_SIGNED_UPLOADED",
      targetId: documentId,
      newValue: {
        employeeId: session.employeeId,
        instanceId: id,
        stepId,
        version: document.version,
        signedFileUrl: uploaded.url,
        fileName: uploaded.fileName,
      },
    });

    return Response.json(apiSuccess(updated, "Signed document uploaded"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload signed document";
    return apiError("Failed", message);
  }
}
