import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { uploadOnboardingFile } from "@/lib/onboarding/storage";
import { completeOnboardingStep } from "@/lib/onboarding/service";
import type { FileUploadStepConfig } from "@/lib/onboarding/types";

type RouteParams = { params: Promise<{ id: string; stepId: string }> };

/** Upload a file for a FILE_UPLOAD onboarding step */
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

    const config = progress.step.config as FileUploadStepConfig;
    const maxSizeMb = config.maxSizeMb ?? 20;
    if (file.size > maxSizeMb * 1024 * 1024) {
      return apiError("Validation failed", `File must be ${maxSizeMb}MB or less`);
    }

    if (config.acceptedTypes?.length) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeOk = config.acceptedTypes.some(
        (t) => t === file.type || t.replace(".", "") === ext
      );
      if (!mimeOk) {
        return apiError("Validation failed", "File type not accepted");
      }
    }

    const uploaded = await uploadOnboardingFile(id, stepId, file);
    if (!uploaded) {
      return apiError("Upload failed", "Could not upload file");
    }

    const updated = await completeOnboardingStep(
      id,
      stepId,
      {
        fileName: file.name,
        fileUrl: uploaded.url,
        uploadedFileUrl: uploaded.url,
        filePath: uploaded.path,
        uploadedAt: new Date().toISOString(),
      },
      session.employeeId
    );

    return Response.json(apiSuccess(updated, "File uploaded"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return apiError("Failed", message);
  }
}
