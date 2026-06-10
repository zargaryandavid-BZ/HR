import { NextRequest } from "next/server";
import { OnboardingStepProgressStatus, OnboardingStepType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { completeOnboardingStep } from "@/lib/onboarding/service";
import { syncOnboardingInstanceIfComplete } from "@/lib/onboarding/instance-status";
import { logOnboardingStepAudit } from "@/lib/onboarding/audit";
import { uploadOnboardingEmployeeFile } from "@/lib/onboarding/storage";
import {
  getOnboardingTasksForEmployee,
  resetOnboardingTaskForReplace,
} from "@/lib/onboarding/tasks";
import type { FileUploadStepConfig } from "@/lib/onboarding/types";

type RouteParams = { params: Promise<{ progressId: string }> };

/** Upload a file for a FILE_UPLOAD onboarding task */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { progressId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const replace = formData.get("replace") === "true";

    if (!file) {
      return apiError("Validation failed", "File is required");
    }

    const progress = await prisma.onboardingStepProgress.findUnique({
      where: { id: progressId },
      include: {
        step: true,
        instance: { select: { id: true, employeeId: true, triggeredById: true } },
      },
    });

    if (!progress || progress.instance.employeeId !== session.employeeId) {
      return apiError("Not found", "Task not found", 404);
    }

    if (progress.step.stepType !== OnboardingStepType.FILE_UPLOAD) {
      return apiError("Invalid", "This task does not accept file uploads");
    }

    if (replace && progress.status === OnboardingStepProgressStatus.COMPLETED) {
      await resetOnboardingTaskForReplace(progressId, session.employeeId);
    }

    if (
      progress.status === OnboardingStepProgressStatus.LOCKED ||
      (progress.status === OnboardingStepProgressStatus.COMPLETED && !replace)
    ) {
      return apiError("Invalid", "Task is not available");
    }

    const config = progress.step.config as FileUploadStepConfig;
    const maxSizeMb = config.maxSizeMb ?? 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      return apiError("Validation failed", `File must be ${maxSizeMb}MB or less`);
    }

    if (config.acceptedTypes?.length) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeOk = config.acceptedTypes.some(
        (type) => type === file.type || type.replace(".", "") === ext
      );
      if (!mimeOk) {
        return apiError("Validation failed", "File type not accepted");
      }
    }

    const uploaded = await uploadOnboardingEmployeeFile(
      session.employeeId,
      progress.stepId,
      file
    );
    if (!uploaded) {
      return apiError("Upload failed", "Could not upload file");
    }

    await completeOnboardingStep(
      progress.instanceId,
      progress.stepId,
      {
        fileName: file.name,
        fileUrl: uploaded.url,
        uploadedFileUrl: uploaded.url,
        filePath: uploaded.path,
        uploadedAt: new Date().toISOString(),
      },
      session.employeeId
    );

    await syncOnboardingInstanceIfComplete(progress.instanceId);

    await logOnboardingStepAudit({
      employeeId: session.employeeId,
      instanceId: progress.instanceId,
      stepId: progress.stepId,
      stepType: progress.step.stepType,
      progressId,
      fallbackUserId: progress.instance.triggeredById,
      extra: { fileName: file.name, uploadedFileUrl: uploaded.url },
    });

    const data = await getOnboardingTasksForEmployee(session.employeeId, {
      excludeDocumentSign: true,
    });

    return Response.json(apiSuccess(data, "File uploaded"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return apiError("Failed", message);
  }
}
