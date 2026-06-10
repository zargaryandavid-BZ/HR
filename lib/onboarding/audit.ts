import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type OnboardingAuditPayload = {
  employeeId: string;
  instanceId: string;
  stepId: string;
  stepType: string;
  progressId: string;
  fallbackUserId?: string;
  extra?: Record<string, unknown>;
};

/** Write an audit log entry for onboarding step actions */
export async function logOnboardingStepAudit({
  employeeId,
  instanceId,
  stepId,
  stepType,
  progressId,
  fallbackUserId,
  extra = {},
}: OnboardingAuditPayload) {
  const linkedUser = await prisma.user.findFirst({
    where: { employeeId },
    select: { id: true },
  });

  const userId = linkedUser?.id ?? fallbackUserId;
  if (!userId) return;

  await prisma.auditLog.create({
    data: {
      userId,
      action: "ONBOARDING_STEP_COMPLETED",
      targetId: progressId,
      targetTable: "OnboardingStepProgress",
      newValue: {
        employeeId,
        instanceId,
        stepId,
        stepType,
        progressId,
        performedBy: employeeId,
        ...extra,
      } as Prisma.InputJsonValue,
    },
  });
}
