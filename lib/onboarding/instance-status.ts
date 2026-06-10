import {
  OnboardingInstanceStatus,
  OnboardingStepProgressStatus,
  OnboardingStepType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type StepProgressRow = {
  status: OnboardingStepProgressStatus;
  step?: { stepType: OnboardingStepType };
};

type InstanceWithProgress = {
  id: string;
  status: OnboardingInstanceStatus;
  completedAt: Date | null;
  stepProgress: StepProgressRow[];
};

/** Count onboarding steps — matches employee portal when document-sign steps are excluded */
export function getOnboardingStepCounts(
  stepProgress: StepProgressRow[],
  options?: { excludeDocumentSign?: boolean }
): { totalSteps: number; completedSteps: number; percent: number } {
  const steps = options?.excludeDocumentSign
    ? stepProgress.filter((p) => p.step?.stepType !== OnboardingStepType.DOCUMENT_SIGN)
    : stepProgress;

  const totalSteps = steps.length;
  const completedSteps = steps.filter(
    (s) => s.status === OnboardingStepProgressStatus.COMPLETED
  ).length;
  const percent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return { totalSteps, completedSteps, percent };
}

/** Whether an onboarding instance still has incomplete employee-facing steps */
export function isOnboardingInProgress(
  instance: InstanceWithProgress,
  options?: { excludeDocumentSign?: boolean }
): boolean {
  if (instance.status === OnboardingInstanceStatus.COMPLETED) {
    return false;
  }

  const { totalSteps, completedSteps } = getOnboardingStepCounts(
    instance.stepProgress,
    options
  );

  if (totalSteps === 0) {
    return (
      instance.status === OnboardingInstanceStatus.NOT_STARTED ||
      instance.status === OnboardingInstanceStatus.IN_PROGRESS
    );
  }

  return completedSteps < totalSteps;
}

/** Mark instance completed when all tracked steps are done (fixes stale IN_PROGRESS rows) */
export async function syncOnboardingInstanceIfComplete(
  instanceId: string
): Promise<boolean> {
  const instance = await prisma.onboardingInstance.findUnique({
    where: { id: instanceId },
    include: {
      stepProgress: { include: { step: { select: { stepType: true } } } },
    },
  });

  if (!instance || instance.status === OnboardingInstanceStatus.COMPLETED) {
    return false;
  }

  const employeeFacing = getOnboardingStepCounts(instance.stepProgress, {
    excludeDocumentSign: true,
  });
  const allSteps = getOnboardingStepCounts(instance.stepProgress);

  const isDone =
    (employeeFacing.totalSteps > 0 &&
      employeeFacing.completedSteps >= employeeFacing.totalSteps) ||
    (allSteps.totalSteps > 0 && allSteps.completedSteps >= allSteps.totalSteps);

  if (!isDone) return false;

  await prisma.onboardingInstance.update({
    where: { id: instanceId },
    data: {
      status: OnboardingInstanceStatus.COMPLETED,
      completedAt: instance.completedAt ?? new Date(),
    },
  });

  return true;
}
