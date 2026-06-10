import {
  OnboardingInstanceStatus,
  OnboardingStepProgressStatus,
  OnboardingStepType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  FormFieldConfig,
  FormStepConfig,
  SurveyQuestionConfig,
  SurveyStepConfig,
} from "@/lib/onboarding/types";
import { completeOnboardingStep } from "@/lib/onboarding/service";
import { syncOnboardingInstanceIfComplete } from "@/lib/onboarding/instance-status";
import { logOnboardingStepAudit } from "@/lib/onboarding/audit";
import type { OnboardingTaskStep, OnboardingTasksPayload } from "@/lib/onboarding/task-types";
import { extractSavedValues } from "@/lib/onboarding/task-types";

export type { OnboardingTaskStep, OnboardingTasksPayload } from "@/lib/onboarding/task-types";

/** Serialize step progress records for API responses */
function serializeProgress(
  progress: {
    id: string;
    status: OnboardingStepProgressStatus;
    completedAt: Date | null;
    responseData: unknown;
    uploadedFileUrl: string | null;
    step: {
      id: string;
      title: string;
      description: string | null;
      stepType: OnboardingStepType;
      sortOrder: number;
      isRequired: boolean;
      config: unknown;
    };
  }
): OnboardingTaskStep {
  return {
    progressId: progress.id,
    stepId: progress.step.id,
    title: progress.step.title,
    description: progress.step.description,
    stepType: progress.step.stepType,
    isRequired: progress.step.isRequired,
    sortOrder: progress.step.sortOrder,
    status: progress.status,
    completedAt: progress.completedAt?.toISOString() ?? null,
    responseData: (progress.responseData as Record<string, unknown> | null) ?? null,
    uploadedFileUrl: progress.uploadedFileUrl,
    config: (progress.step.config as Record<string, unknown>) ?? {},
  };
}

/** Fetch onboarding task progress for an employee */
export async function getOnboardingTasksForEmployee(
  employeeId: string,
  options?: { excludeDocumentSign?: boolean }
): Promise<OnboardingTasksPayload> {
  const instance = await prisma.onboardingInstance.findFirst({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    include: {
      stepProgress: {
        include: { step: true },
        where: options?.excludeDocumentSign
          ? { step: { stepType: { not: OnboardingStepType.DOCUMENT_SIGN } } }
          : undefined,
        orderBy: { step: { sortOrder: "asc" } },
      },
    },
  });

  if (!instance) {
    return {
      instanceId: null,
      instanceStatus: null,
      steps: [],
      pendingCount: 0,
      completedCount: 0,
    };
  }

  const steps = instance.stepProgress.map(serializeProgress);
  const completedCount = steps.filter((s) => s.status === "COMPLETED").length;
  const pendingCount = steps.filter(
    (s) => s.status === "AVAILABLE" || s.status === "IN_PROGRESS"
  ).length;

  return {
    instanceId: instance.id,
    instanceStatus: instance.status,
    steps,
    pendingCount,
    completedCount,
  };
}

/** Load progress record and verify employee ownership */
async function getAuthorizedProgress(progressId: string, employeeId: string) {
  const progress = await prisma.onboardingStepProgress.findUnique({
    where: { id: progressId },
    include: {
      step: true,
      instance: { select: { id: true, employeeId: true, triggeredById: true, status: true } },
    },
  });

  if (!progress || progress.instance.employeeId !== employeeId) {
    throw new Error("Task not found");
  }

  return progress;
}

/** Convert field values to label-keyed responseData */
export function formatFormResponseData(
  fields: FormFieldConfig[],
  values: Record<string, string | boolean>
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const field of fields) {
    const value = values[field.id];
    if (value !== undefined && value !== "") {
      result[field.label] = value;
    }
  }
  return result;
}

/** Convert survey values to question-keyed responseData */
export function formatSurveyResponseData(
  questions: SurveyQuestionConfig[],
  values: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const question of questions) {
    const value = values[question.id];
    if (value !== undefined && value !== "") {
      result[question.question] = value;
    }
  }
  return result;
}

/** Validate required form fields server-side */
export function validateFormFields(
  fields: FormFieldConfig[],
  values: Record<string, string | boolean>
): string | null {
  for (const field of fields) {
    if (!field.required) continue;
    const value = values[field.id];
    if (value === undefined || value === null || value === "") {
      return `${field.label} is required`;
    }
  }
  return null;
}

/** Validate required survey questions server-side */
export function validateSurveyQuestions(
  questions: SurveyQuestionConfig[],
  values: Record<string, string>
): string | null {
  for (const question of questions) {
    if (!question.required) continue;
    const value = values[question.id];
    if (!value) {
      return `${question.question} is required`;
    }
  }
  return null;
}

/** Save in-progress form/survey data without completing the step */
export async function saveOnboardingTaskDraft(
  progressId: string,
  employeeId: string,
  responseData: Record<string, unknown>
) {
  const progress = await getAuthorizedProgress(progressId, employeeId);

  if (
    progress.status === OnboardingStepProgressStatus.LOCKED ||
    progress.status === OnboardingStepProgressStatus.COMPLETED
  ) {
    throw new Error("Task is not editable");
  }

  await prisma.$transaction(async (tx) => {
    await tx.onboardingStepProgress.update({
      where: { id: progressId },
      data: {
        status: OnboardingStepProgressStatus.IN_PROGRESS,
        responseData: responseData as object,
      },
    });

    if (progress.instance.status === OnboardingInstanceStatus.NOT_STARTED) {
      await tx.onboardingInstance.update({
        where: { id: progress.instanceId },
        data: {
          status: OnboardingInstanceStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }
  });
}

/** Complete a form or survey onboarding task */
export async function completeOnboardingTask(
  progressId: string,
  employeeId: string,
  responseData: Record<string, unknown>,
  complete = true
) {
  const progress = await getAuthorizedProgress(progressId, employeeId);

  if (!complete) {
    await saveOnboardingTaskDraft(progressId, employeeId, responseData);
    return getOnboardingTasksForEmployee(employeeId, { excludeDocumentSign: true });
  }

  if (progress.step.stepType === OnboardingStepType.FORM) {
    const config = progress.step.config as FormStepConfig;
    const fields = config.fields ?? [];
    const values = extractSavedValues(responseData, fields);
    const validationError = validateFormFields(fields, values);
    if (validationError) throw new Error(validationError);
    responseData = formatFormResponseData(fields, values);
  }

  if (progress.step.stepType === OnboardingStepType.SURVEY) {
    const config = progress.step.config as SurveyStepConfig;
    const questions = config.questions ?? [];
    const values = extractSavedValues(
      responseData,
      questions.map((question) => ({ id: question.id, label: question.question }))
    ) as Record<string, string>;
    const validationError = validateSurveyQuestions(questions, values);
    if (validationError) throw new Error(validationError);
    responseData = formatSurveyResponseData(questions, values);
  }

  await completeOnboardingStep(
    progress.instanceId,
    progress.stepId,
    responseData,
    employeeId
  );

  await syncOnboardingInstanceIfComplete(progress.instanceId);

  await logOnboardingStepAudit({
    employeeId,
    instanceId: progress.instanceId,
    stepId: progress.stepId,
    stepType: progress.step.stepType,
    progressId,
    fallbackUserId: progress.instance.triggeredById,
  });

  return getOnboardingTasksForEmployee(employeeId, { excludeDocumentSign: true });
}

/** Reset a completed file upload step so the employee can replace the file */
export async function resetOnboardingTaskForReplace(progressId: string, employeeId: string) {
  const progress = await getAuthorizedProgress(progressId, employeeId);

  if (progress.step.stepType !== OnboardingStepType.FILE_UPLOAD) {
    throw new Error("Only upload tasks can be replaced");
  }

  if (progress.status !== OnboardingStepProgressStatus.COMPLETED) {
    return;
  }

  await prisma.onboardingStepProgress.update({
    where: { id: progressId },
    data: {
      status: OnboardingStepProgressStatus.AVAILABLE,
      completedAt: null,
    },
  });
}
