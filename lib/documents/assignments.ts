import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logDocumentAudit } from "@/lib/documents/service";
import { extractFlowDocumentIds } from "@/lib/onboarding/flow-documents";
import { formatEmployeeName } from "@/lib/utils";
import { createEmployeeNotification } from "@/lib/notifications";
import {
  getEmployeeDocumentsWithStatus,
} from "@/lib/individual-settings/documents";
import { isDocumentHrConfirmed } from "@/lib/individual-settings/constants";

const activeDocFilter = { isActive: true, status: "ACTIVE" as const };

/** Create unsent company-wide document assignments for a new employee */
export async function seedCompanyWideDocumentAssignments(
  employeeId: string,
  assignedById: string,
  tx: Prisma.TransactionClient = prisma
) {
  const docs = await tx.sop.findMany({
    where: { scope: "COMPANY_WIDE", ...activeDocFilter },
    select: { id: true },
  });

  if (!docs.length) return;

  await tx.documentAssignment.createMany({
    data: docs.map((doc) => ({
      sopId: doc.id,
      employeeId,
      assignedById,
      assignedManually: false,
      isOffboarding: false,
      sentAt: null,
    })),
    skipDuplicates: true,
  });
}

/** Assign automation flow documents silently when an employee is created (sentAt null) */
export async function seedAutomationDocumentAssignments(
  employeeId: string,
  positionId: string | null,
  assignedById: string,
  tx: Prisma.TransactionClient = prisma
) {
  if (!positionId) return;

  const template = await tx.onboardingTemplate.findFirst({
    where: { positionId, isActive: true },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) return;

  const documentIds = extractFlowDocumentIds(template.steps);
  if (!documentIds.length) return;

  const activeDocs = await tx.sop.findMany({
    where: { id: { in: documentIds }, ...activeDocFilter },
    select: { id: true },
  });

  if (!activeDocs.length) return;

  await tx.documentAssignment.createMany({
    data: activeDocs.map((doc) => ({
      sopId: doc.id,
      employeeId,
      assignedById,
      assignedManually: false,
      isOffboarding: false,
      sentAt: null,
    })),
    skipDuplicates: true,
  });
}

/** Backfill missing company-wide and position-automation assignments for an employee */
export async function syncEmployeeDocumentAssignments(
  employeeId: string,
  assignedByUserId: string
): Promise<{ added: number }> {
  const before = await prisma.documentAssignment.count({ where: { employeeId } });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { positionId: true },
  });

  if (!employee) return { added: 0 };

  await seedCompanyWideDocumentAssignments(employeeId, assignedByUserId);
  if (employee.positionId) {
    await seedAutomationDocumentAssignments(
      employeeId,
      employee.positionId,
      assignedByUserId
    );
  }

  const after = await prisma.documentAssignment.count({ where: { employeeId } });
  return { added: after - before };
}

/** Send all unsent document assignments to the employee portal */
export async function sendUnsentOnboardingDocuments(
  employeeId: string,
  sentByUserId: string
): Promise<{ sent: number; employeeName: string }> {
  const docs = await listSendableOnboardingDocuments(employeeId, sentByUserId);
  const unsentIds = docs.filter((doc) => !doc.alreadySent).map((doc) => doc.id);
  if (!unsentIds.length) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true, preferredName: true },
    });
    return {
      sent: 0,
      employeeName: employee
        ? formatEmployeeName(employee.firstName, employee.lastName, employee.preferredName)
        : "Employee",
    };
  }
  return sendSelectedOnboardingDocuments(employeeId, unsentIds, sentByUserId);
}

export type SendableOnboardingDocument = {
  id: string;
  assignmentId: string | null;
  title: string;
  status: string;
  alreadySent: boolean;
};

/** Documents not yet HR-approved — eligible for send-for-signature */
export async function listSendableOnboardingDocuments(
  employeeId: string,
  assignedByUserId: string
): Promise<SendableOnboardingDocument[]> {
  await syncEmployeeDocumentAssignments(employeeId, assignedByUserId);

  const docs = await getEmployeeDocumentsWithStatus(employeeId);
  return [...docs.companyWide, ...docs.assigned]
    .filter((doc) => !isDocumentHrConfirmed(doc.status))
    .map((doc) => ({
      id: doc.id,
      assignmentId: doc.assignmentId,
      title: doc.title,
      status: doc.status,
      alreadySent: Boolean(doc.assignmentSentAt),
    }));
}

/** Send selected onboarding documents to the employee portal for signature */
export async function sendSelectedOnboardingDocuments(
  employeeId: string,
  documentIds: string[],
  sentByUserId: string
): Promise<{ sent: number; employeeName: string }> {
  await syncEmployeeDocumentAssignments(employeeId, sentByUserId);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, preferredName: true },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  const employeeName = formatEmployeeName(
    employee.firstName,
    employee.lastName,
    employee.preferredName
  );

  const docs = await getEmployeeDocumentsWithStatus(employeeId);
  const selected = [...docs.companyWide, ...docs.assigned].filter(
    (doc) => documentIds.includes(doc.id) && !isDocumentHrConfirmed(doc.status)
  );

  const assignmentIds = selected
    .map((doc) => doc.assignmentId)
    .filter((id): id is string => Boolean(id));

  if (!assignmentIds.length) {
    return { sent: 0, employeeName };
  }

  const now = new Date();

  await prisma.documentAssignment.updateMany({
    where: { id: { in: assignmentIds } },
    data: { sentAt: now },
  });

  const count = assignmentIds.length;

  await createEmployeeNotification({
    employeeId,
    type: "ONBOARDING_STARTED",
    title: "Your onboarding documents are ready",
    message: `${count} onboarding document${count !== 1 ? "s are" : " is"} ready for you. Please log in to review and sign them.`,
  });

  await logDocumentAudit({
    userId: sentByUserId,
    action: "ONBOARDING_DOCS_SENT",
    targetId: employeeId,
    targetTable: "Employee",
    newValue: { employeeId, count, documentIds: selected.map((d) => d.id), sentById: sentByUserId },
  });

  return { sent: count, employeeName };
}
