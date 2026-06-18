import { OnboardingInstanceStatus, OnboardingStepProgressStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOnboardingInProgress } from "@/lib/onboarding/instance-status";
import { logDocumentAudit } from "@/lib/documents/service";
import { sendEmail } from "@/lib/instantly";
import { sendSms } from "@/lib/twilio";
import { formatEmployeeName } from "@/lib/utils";
import type { DocumentSignStepConfig } from "@/lib/onboarding/types";

import { getAppUrl } from "@/lib/app-url";

/** Build the employee-facing onboarding portal URL */
export function getOnboardingPortalUrl(instanceId: string): string {
  const appUrl = getAppUrl();
  return `${appUrl}/employee/onboarding/${instanceId}`;
}

/** Send onboarding invite notifications to an employee */
export async function sendOnboardingInvite(
  employee: {
    firstName: string;
    lastName: string;
    preferredName: string | null;
    workEmail: string | null;
    phone: string | null;
  },
  positionName: string,
  stepCount: number,
  instanceId: string
): Promise<void> {
  const name = formatEmployeeName(employee.firstName, employee.lastName, employee.preferredName);
  const portalUrl = getOnboardingPortalUrl(instanceId);

  if (employee.workEmail) {
    await sendEmail(
      employee.workEmail,
      `Your onboarding for ${positionName} is ready`,
      `<p>Hi ${name},</p>
       <p>Your onboarding for <strong>${positionName}</strong> is ready. It includes ${stepCount} step${stepCount === 1 ? "" : "s"}.</p>
       <p><a href="${portalUrl}">Start your onboarding</a></p>
       <p>Complete each step in order. If you have questions, contact HR.</p>`
    );
  }

  if (employee.phone) {
    await sendSms(
      employee.phone,
      `Hi ${name}, your Bazaar Printing onboarding for ${positionName} is ready (${stepCount} steps). Start here: ${portalUrl}`
    );
  }
}

/** Notify HR when an employee completes onboarding */
export async function notifyOnboardingCompletion(instanceId: string): Promise<void> {
  const instance = await prisma.onboardingInstance.findUnique({
    where: { id: instanceId },
    include: {
      employee: true,
      template: { include: { position: true } },
      triggeredBy: { include: { employee: true } },
    },
  });

  if (!instance) return;

  const employeeName = formatEmployeeName(
    instance.employee.firstName,
    instance.employee.lastName,
    instance.employee.preferredName
  );
  const positionName = instance.template.position.name;
  const message = `${employeeName} has completed their onboarding for ${positionName}.`;

  const hrEmployeeId = instance.triggeredBy.employeeId;
  if (hrEmployeeId) {
    await prisma.notification.create({
      data: {
        employeeId: hrEmployeeId,
        eventType: "ONBOARDING_COMPLETED",
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
        contentSnapshot: {
          message,
          instanceId: instance.id,
          employeeId: instance.employeeId,
          positionName,
        },
      },
    });
  }

  const hrEmail = instance.triggeredBy.email;
  await sendEmail(
    hrEmail,
    `Onboarding completed: ${employeeName}`,
    `<p>${message}</p>
     <p>View the employee profile in the HR portal for their onboarding documents and status.</p>`
  );
}

/** Create onboarding instance with sequential step progress records */
export async function createOnboardingInstance(
  employeeId: string,
  templateId: string,
  triggeredByUserId: string
) {
  const template = await prisma.onboardingTemplate.findUnique({
    where: { id: templateId },
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      position: true,
    },
  });

  if (!template || !template.isActive) {
    throw new Error("Template not found or inactive");
  }

  if (template.steps.length === 0) {
    throw new Error("Template has no steps");
  }

  const activeInstance = await prisma.onboardingInstance.findFirst({
    where: {
      employeeId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
    },
    include: {
      stepProgress: {
        select: {
          status: true,
          step: { select: { stepType: true } },
        },
      },
    },
  });

  if (
    activeInstance &&
    isOnboardingInProgress(activeInstance, { excludeDocumentSign: true })
  ) {
    throw new Error("Employee already has an active onboarding instance");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { position: true },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  if (employee.positionId && employee.positionId !== template.positionId) {
    throw new Error(
      "This onboarding automation belongs to a different position than the employee"
    );
  }

  const now = new Date();

  const instance = await prisma.onboardingInstance.create({
    data: {
      employeeId,
      templateId,
      triggeredById: triggeredByUserId,
      status: OnboardingInstanceStatus.IN_PROGRESS,
      startedAt: now,
      stepProgress: {
        create: template.steps.map((step, index) => ({
          stepId: step.id,
          status:
            index === 0
              ? OnboardingStepProgressStatus.AVAILABLE
              : OnboardingStepProgressStatus.LOCKED,
        })),
      },
    },
    include: {
      stepProgress: { include: { step: true }, orderBy: { step: { sortOrder: "asc" } } },
      template: { include: { position: true, steps: true } },
      employee: true,
    },
  });

  await logDocumentAudit({
    userId: triggeredByUserId,
    action: "ONBOARDING_INSTANCE_CREATED",
    targetId: instance.id,
    targetTable: "OnboardingInstance",
    newValue: {
      employeeId,
      templateId,
    },
  });

  return instance;
}

/** Mark a step complete and advance the onboarding instance */
export async function completeOnboardingStep(
  instanceId: string,
  stepId: string,
  responseData: unknown,
  employeeId: string
) {
  const instance = await prisma.onboardingInstance.findUnique({
    where: { id: instanceId },
    include: {
      stepProgress: {
        include: { step: true },
        orderBy: { step: { sortOrder: "asc" } },
      },
    },
  });

  if (!instance || instance.employeeId !== employeeId) {
    throw new Error("Instance not found");
  }

  if (instance.status === OnboardingInstanceStatus.COMPLETED) {
    throw new Error("Onboarding already completed");
  }

  const progress = instance.stepProgress.find((p) => p.stepId === stepId);
  if (!progress) {
    throw new Error("Step not found");
  }

  if (
    progress.status !== OnboardingStepProgressStatus.AVAILABLE &&
    progress.status !== OnboardingStepProgressStatus.IN_PROGRESS
  ) {
    throw new Error("Step is not available");
  }

  const now = new Date();
  const progressIndex = instance.stepProgress.findIndex((p) => p.stepId === stepId);
  const nextProgress = instance.stepProgress[progressIndex + 1];

  await prisma.$transaction(async (tx) => {
    await tx.onboardingStepProgress.update({
      where: { id: progress.id },
      data: {
        status: OnboardingStepProgressStatus.COMPLETED,
        completedAt: now,
        responseData: responseData as object,
        uploadedFileUrl:
          typeof responseData === "object" &&
          responseData !== null &&
          ("uploadedFileUrl" in responseData || "signedFileUrl" in responseData || "fileUrl" in responseData)
            ? String(
                (responseData as Record<string, unknown>).uploadedFileUrl ??
                  (responseData as Record<string, unknown>).signedFileUrl ??
                  (responseData as Record<string, unknown>).fileUrl
              )
            : undefined,
      },
    });

    if (nextProgress) {
      await tx.onboardingStepProgress.update({
        where: { id: nextProgress.id },
        data: { status: OnboardingStepProgressStatus.AVAILABLE },
      });
    }

    const updateData: {
      status: OnboardingInstanceStatus;
      startedAt?: Date;
      completedAt?: Date;
    } = {
      status: nextProgress
        ? OnboardingInstanceStatus.IN_PROGRESS
        : OnboardingInstanceStatus.COMPLETED,
    };

    if (!instance.startedAt) {
      updateData.startedAt = now;
    }

    if (!nextProgress) {
      updateData.completedAt = now;
    }

    await tx.onboardingInstance.update({
      where: { id: instanceId },
      data: updateData,
    });
  });

  if (!nextProgress) {
    await notifyOnboardingCompletion(instanceId);
  }

  return prisma.onboardingInstance.findUnique({
    where: { id: instanceId },
    include: {
      stepProgress: {
        include: { step: true },
        orderBy: { step: { sortOrder: "asc" } },
      },
      template: { include: { position: { include: { department: true } }, steps: true } },
      employee: { include: { position: true } },
    },
  });
}

type DocumentUploadPayload = {
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  signedFileUrl: string;
  fileName: string;
};

/** Advance matching DOCUMENT_SIGN automation steps after an employee uploads a signed copy */
export async function completeDocumentSignStepsForUpload(
  employeeId: string,
  payload: DocumentUploadPayload
): Promise<void> {
  const instance = await prisma.onboardingInstance.findFirst({
    where: {
      employeeId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      stepProgress: {
        include: { step: true },
        orderBy: { step: { sortOrder: "asc" } },
      },
    },
  });

  if (!instance) return;

  const now = new Date();
  const responseData = {
    documentId: payload.documentId,
    documentTitle: payload.documentTitle,
    documentVersion: payload.documentVersion,
    signedFileUrl: payload.signedFileUrl,
    uploadedFileUrl: payload.signedFileUrl,
    fileName: payload.fileName,
    signedAt: now.toISOString(),
    acknowledgedAt: now.toISOString(),
  };

  for (const progress of instance.stepProgress) {
    if (progress.step.stepType !== "DOCUMENT_SIGN") continue;
    if (progress.status === "COMPLETED") continue;

    const config = progress.step.config as DocumentSignStepConfig;
    if (config.documentId !== payload.documentId) continue;

    await completeOnboardingStep(
      instance.id,
      progress.step.id,
      responseData,
      employeeId
    );
    return;
  }
}
