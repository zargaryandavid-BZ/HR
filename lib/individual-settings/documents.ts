import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAssignmentTags } from "@/lib/documents/service";
import type { DocumentCompletionStatus, EmployeeDocumentStatusItem } from "./constants";
import { isDocumentHrConfirmed } from "./constants";
import type { DocumentSignStepConfig } from "@/lib/onboarding/types";

const activeDocFilter = { isActive: true, status: "ACTIVE" as const };

const sopInclude = {
  positionLinks: {
    include: {
      position: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

type AssignmentStatusFields = {
  id: string;
  sentAt: Date | null;
  assignedManually: boolean;
  signedFileUrl: string | null;
  signedAt: Date | null;
  acknowledgedAt: Date | null;
  hrApprovedAt: Date | null;
  hrApprovedBy: string | null;
};

type GetEmployeeDocumentsOptions = {
  /**
   * Employee portal: documents HR has sent, or any with employee signing progress
   * (onboarding flow uploads may set signedAt without sentAt).
   */
  sentOnly?: boolean;
};

/** Build viewed document IDs from onboarding step progress */
function buildViewedDocumentIds(
  onboardingInstances: Array<{
    stepProgress: Array<{
      status: string;
      responseData: unknown;
      step: { stepType: string; config: unknown };
    }>;
  }>
): Set<string> {
  const viewedDocumentIds = new Set<string>();

  for (const instance of onboardingInstances) {
    for (const progress of instance.stepProgress) {
      if (progress.step.stepType !== "DOCUMENT_SIGN") continue;
      const config = progress.step.config as DocumentSignStepConfig;
      if (!config.documentId) continue;
      if (
        progress.status === "IN_PROGRESS" ||
        progress.status === "COMPLETED" ||
        progress.responseData
      ) {
        viewedDocumentIds.add(config.documentId);
      }
    }
  }

  return viewedDocumentIds;
}

/** Resolve document completion status from assignment and onboarding progress */
function resolveDocumentStatus(
  assignment: AssignmentStatusFields | null,
  onboardingViewed: boolean
): DocumentCompletionStatus {
  if (!assignment) return "not_started";
  if (assignment.hrApprovedAt) return "hr_approved";
  if (assignment.signedFileUrl && assignment.signedAt) return "signed";
  if (assignment.signedFileUrl && !assignment.signedAt) return "signature_required";
  if (assignment.acknowledgedAt) return "acknowledged";
  if (onboardingViewed) return "downloaded";
  return "not_started";
}

/** Whether an onboarding document is still awaiting HR confirmation */
export function isMissingSignedDocument(status: DocumentCompletionStatus): boolean {
  return !isDocumentHrConfirmed(status);
}

/** Count onboarding documents not yet HR-approved for one employee */
export async function countUnconfirmedDocuments(employeeId: string): Promise<number> {
  const docs = await getEmployeeDocumentsWithStatus(employeeId);
  const all = [...docs.companyWide, ...docs.assigned];
  return all.filter((doc) => !isDocumentHrConfirmed(doc.status)).length;
}

/** Count unsent onboarding documents for one employee */
export async function countUnsentDocuments(employeeId: string): Promise<number> {
  return prisma.documentAssignment.count({
    where: {
      employeeId,
      isOffboarding: false,
      sentAt: null,
      sop: activeDocFilter,
    },
  });
}

type EmployeeScope = {
  id: string;
  positionId: string | null;
  departmentId: string | null;
};

/** Count onboarding documents missing a signed copy for each employee (batch) */
export async function getMissingSignedDocumentCounts(
  employees: EmployeeScope[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!employees.length) return counts;

  const employeeIds = employees.map((employee) => employee.id);

  const [assignments, onboardingInstances] = await Promise.all([
    prisma.documentAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        sentAt: { not: null },
        sop: activeDocFilter,
      },
      select: {
        employeeId: true,
        sopId: true,
        sentAt: true,
        signedFileUrl: true,
        signedAt: true,
        acknowledgedAt: true,
        hrApprovedAt: true,
      },
    }),
    prisma.onboardingInstance.findMany({
      where: { employeeId: { in: employeeIds } },
      include: {
        stepProgress: {
          include: { step: true },
        },
      },
    }),
  ]);

  const assignmentsByEmployee = new Map<string, Map<string, AssignmentStatusFields>>();
  for (const assignment of assignments) {
    if (!assignmentsByEmployee.has(assignment.employeeId)) {
      assignmentsByEmployee.set(assignment.employeeId, new Map());
    }
    assignmentsByEmployee.get(assignment.employeeId)!.set(assignment.sopId, {
      id: assignment.sopId,
      sentAt: assignment.sentAt,
      assignedManually: false,
      signedFileUrl: assignment.signedFileUrl,
      signedAt: assignment.signedAt,
      acknowledgedAt: assignment.acknowledgedAt,
      hrApprovedAt: assignment.hrApprovedAt,
      hrApprovedBy: null,
    });
  }

  const onboardingByEmployee = new Map<string, typeof onboardingInstances>();
  for (const instance of onboardingInstances) {
    const list = onboardingByEmployee.get(instance.employeeId) ?? [];
    list.push(instance);
    onboardingByEmployee.set(instance.employeeId, list);
  }

  for (const employee of employees) {
    const employeeAssignments = assignmentsByEmployee.get(employee.id) ?? new Map();
    const viewedDocumentIds = buildViewedDocumentIds(
      onboardingByEmployee.get(employee.id) ?? []
    );

    let missing = 0;
    for (const [docId, assignment] of employeeAssignments) {
      const status = resolveDocumentStatus(assignment, viewedDocumentIds.has(docId));
      if (isMissingSignedDocument(status)) missing++;
    }

    counts.set(employee.id, missing);
  }

  return counts;
}

/** Fetch assigned documents for an employee with completion status */
export async function getEmployeeDocumentsWithStatus(
  employeeId: string,
  options: GetEmployeeDocumentsOptions = {}
): Promise<{
  companyWide: EmployeeDocumentStatusItem[];
  assigned: EmployeeDocumentStatusItem[];
}> {
  const { sentOnly = false } = options;

  const [assignments, onboardingInstances] = await Promise.all([
    prisma.documentAssignment.findMany({
      where: {
        employeeId,
        isOffboarding: false,
        sop: activeDocFilter,
        ...(sentOnly
          ? {
              OR: [
                { sentAt: { not: null } },
                { signedFileUrl: { not: null } },
                { acknowledgedAt: { not: null } },
                { hrApprovedAt: { not: null } },
              ],
            }
          : {}),
      },
      include: { sop: { include: sopInclude } },
      orderBy: { sop: { title: "asc" } },
    }),
    prisma.onboardingInstance.findMany({
      where: { employeeId },
      include: {
        stepProgress: {
          include: { step: true },
        },
      },
    }),
  ]);

  const viewedDocumentIds = buildViewedDocumentIds(onboardingInstances);

  function serializeAssignment(
    assignment: (typeof assignments)[number]
  ): EmployeeDocumentStatusItem {
    const doc = assignment.sop;
    const scope = doc.scope;
    const status = resolveDocumentStatus(
      {
        id: assignment.id,
        sentAt: assignment.sentAt,
        assignedManually: assignment.assignedManually,
        signedFileUrl: assignment.signedFileUrl,
        signedAt: assignment.signedAt,
        acknowledgedAt: assignment.acknowledgedAt,
        hrApprovedAt: assignment.hrApprovedAt,
        hrApprovedBy: assignment.hrApprovedBy,
      },
      viewedDocumentIds.has(doc.id)
    );

    return {
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      version: doc.version,
      fileUrl: doc.fileUrl,
      scope,
      status,
      assignmentId: assignment.id,
      signedFileUrl: assignment.signedFileUrl,
      signedAt: assignment.signedAt?.toISOString() ?? null,
      acknowledgedAt: assignment.acknowledgedAt?.toISOString() ?? null,
      hrApprovedAt: assignment.hrApprovedAt?.toISOString() ?? null,
      hrApprovedBy: assignment.hrApprovedBy ?? null,
      assignmentSentAt: assignment.sentAt?.toISOString() ?? null,
      assignedManually: assignment.assignedManually,
      assignmentTags:
        scope === "POSITION_SPECIFIC" || assignment.assignedManually
          ? buildAssignmentTags(doc.positionLinks)
          : [],
    };
  }

  const companyWide: EmployeeDocumentStatusItem[] = [];
  const assigned: EmployeeDocumentStatusItem[] = [];

  for (const assignment of assignments) {
    const item = serializeAssignment(assignment);
    if (assignment.sop.scope === "COMPANY_WIDE" && !assignment.assignedManually) {
      companyWide.push(item);
    } else {
      assigned.push(item);
    }
  }

  return { companyWide, assigned };
}

/** Resolve display names for user IDs */
export async function resolveUserNames(
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });

  return new Map(users.map((u) => [u.id, u.name?.trim() || u.email]));
}
