import type { Prisma } from "@prisma/client";
import { OnboardingStepProgressStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { offboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { logDocumentAudit } from "@/lib/documents/service";
import { createEmployeeNotification } from "@/lib/notifications";
import { formatEmployeeName } from "@/lib/utils";
import { extractOffboardingFlowDocumentIds } from "@/lib/offboarding/flow-documents";

const activeDocFilter = { isActive: true, status: "ACTIVE" as const };

/** Start offboarding when an employee is deactivated */
export async function initiateOffboarding(
  employeeId: string,
  triggeredByUserId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<{ instanceId: string; docsAssigned: number }> {
  const existing = await tx.offboardingInstance.findFirst({
    where: { employeeId, status: "IN_PROGRESS" },
    select: { id: true },
  });

  if (existing) {
    return { instanceId: existing.id, docsAssigned: 0 };
  }

  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, positionId: true },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  const template = employee.positionId
    ? await tx.offboardingTemplate.findUnique({
        where: { positionId: employee.positionId },
        include: { steps: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const instance = await tx.offboardingInstance.create({
    data: {
      employeeId,
      templateId: template?.id ?? null,
      triggeredById: triggeredByUserId,
      status: "IN_PROGRESS",
      stepProgress: template?.steps.length
        ? {
            create: template.steps.map((step, index) => ({
              stepId: step.id,
              status:
                index === 0
                  ? OnboardingStepProgressStatus.AVAILABLE
                  : OnboardingStepProgressStatus.LOCKED,
            })),
          }
        : undefined,
    },
  });

  let docsAssigned = 0;

  if (template) {
    const documentIds = extractOffboardingFlowDocumentIds(template.steps);
    const activeDocs = await tx.sop.findMany({
      where: { id: { in: documentIds }, ...activeDocFilter },
      select: { id: true },
    });

    for (const doc of activeDocs) {
      await tx.documentAssignment.upsert({
        where: {
          sopId_employeeId_isOffboarding: offboardingAssignmentKey(doc.id, employeeId),
        },
        create: {
          sopId: doc.id,
          employeeId,
          assignedById: triggeredByUserId,
          assignedManually: false,
          isOffboarding: true,
          offboardingSentAt: null,
        },
        update: {},
      });
      docsAssigned++;
    }
  }

  await logDocumentAudit({
    userId: triggeredByUserId,
    action: "OFFBOARDING_INSTANCE_CREATED",
    targetId: instance.id,
    targetTable: "OffboardingInstance",
    newValue: { employeeId, templateId: template?.id ?? null, docsAssigned },
  });

  return { instanceId: instance.id, docsAssigned };
}

/** Ensure an offboarding instance exists before manual doc assignment */
export async function ensureOffboardingInstance(
  employeeId: string,
  triggeredByUserId: string
): Promise<string> {
  const existing = await prisma.offboardingInstance.findFirst({
    where: { employeeId, status: "IN_PROGRESS" },
    select: { id: true },
  });

  if (existing) return existing.id;

  const instance = await prisma.offboardingInstance.create({
    data: {
      employeeId,
      triggeredById: triggeredByUserId,
      status: "IN_PROGRESS",
    },
  });

  return instance.id;
}

/** Send all unsent offboarding document assignments to the employee portal */
export async function sendUnsentOffboardingDocuments(
  employeeId: string,
  sentByUserId: string
): Promise<{ sent: number; employeeName: string }> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, preferredName: true },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  const unsent = await prisma.documentAssignment.findMany({
    where: {
      employeeId,
      isOffboarding: true,
      offboardingSentAt: null,
      sop: activeDocFilter,
    },
    select: { id: true },
  });

  const employeeName = formatEmployeeName(
    employee.firstName,
    employee.lastName,
    employee.preferredName
  );

  if (!unsent.length) {
    return { sent: 0, employeeName };
  }

  const now = new Date();

  await prisma.documentAssignment.updateMany({
    where: { id: { in: unsent.map((row) => row.id) } },
    data: { offboardingSentAt: now },
  });

  const count = unsent.length;

  await createEmployeeNotification({
    employeeId,
    type: "OFFBOARDING_STARTED",
    title: "Your offboarding documents are ready",
    message: `${count} offboarding document${count !== 1 ? "s" : ""} require your attention. Please log in to complete them before your last day.`,
  });

  await logDocumentAudit({
    userId: sentByUserId,
    action: "OFFBOARDING_DOCS_SENT",
    targetId: employeeId,
    targetTable: "Employee",
    newValue: { employeeId, count, sentById: sentByUserId },
  });

  return { sent: count, employeeName };
}
