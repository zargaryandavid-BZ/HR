import { prisma } from "@/lib/prisma";
import { buildAssignmentTags } from "@/lib/documents/service";
import type {
  DocumentCompletionStatus,
  EmployeeDocumentStatusItem,
} from "./constants";
import { isDocumentHrConfirmed } from "./constants";

const activeDocFilter = { isActive: true, status: "ACTIVE" as const };

type AssignmentStatusFields = {
  id: string;
  offboardingSentAt: Date | null;
  assignedManually: boolean;
  signedFileUrl: string | null;
  signedAt: Date | null;
  acknowledgedAt: Date | null;
  hrApprovedAt: Date | null;
  hrApprovedBy: string | null;
};

type GetOffboardingDocumentsOptions = {
  /** Employee portal: only documents HR has sent */
  sentOnly?: boolean;
};

function resolveDocumentStatus(assignment: AssignmentStatusFields | null): DocumentCompletionStatus {
  if (!assignment) return "not_started";
  if (assignment.hrApprovedAt) return "hr_approved";
  if (assignment.signedFileUrl && assignment.signedAt) return "signed";
  if (assignment.signedFileUrl && !assignment.signedAt) return "signature_required";
  if (assignment.acknowledgedAt) return "acknowledged";
  return "not_started";
}

/** Fetch offboarding document assignments with completion status */
export async function getEmployeeOffboardingDocuments(
  employeeId: string,
  options: GetOffboardingDocumentsOptions = {}
): Promise<{
  autoAssigned: EmployeeDocumentStatusItem[];
  manuallyAssigned: EmployeeDocumentStatusItem[];
}> {
  const { sentOnly = false } = options;

  const assignments = await prisma.documentAssignment.findMany({
    where: {
      employeeId,
      isOffboarding: true,
      sop: activeDocFilter,
      ...(sentOnly ? { offboardingSentAt: { not: null } } : {}),
    },
    include: { sop: { include: { positionLinks: { include: { position: true, department: true } } } } },
    orderBy: { sop: { title: "asc" } },
  });

  const autoAssigned: EmployeeDocumentStatusItem[] = [];
  const manuallyAssigned: EmployeeDocumentStatusItem[] = [];

  for (const assignment of assignments) {
    const doc = assignment.sop;
    const status = resolveDocumentStatus({
      id: assignment.id,
      offboardingSentAt: assignment.offboardingSentAt,
      assignedManually: assignment.assignedManually,
      signedFileUrl: assignment.signedFileUrl,
      signedAt: assignment.signedAt,
      acknowledgedAt: assignment.acknowledgedAt,
      hrApprovedAt: assignment.hrApprovedAt,
      hrApprovedBy: assignment.hrApprovedBy,
    });

    const item: EmployeeDocumentStatusItem = {
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      version: doc.version,
      fileUrl: doc.fileUrl,
      scope: doc.scope,
      status,
      assignmentId: assignment.id,
      signedFileUrl: assignment.signedFileUrl,
      signedAt: assignment.signedAt?.toISOString() ?? null,
      acknowledgedAt: assignment.acknowledgedAt?.toISOString() ?? null,
      hrApprovedAt: assignment.hrApprovedAt?.toISOString() ?? null,
      hrApprovedBy: assignment.hrApprovedBy ?? null,
      assignmentSentAt: assignment.offboardingSentAt?.toISOString() ?? null,
      assignedManually: assignment.assignedManually,
      assignmentTags: buildAssignmentTags(doc.positionLinks),
    };

    if (assignment.assignedManually) {
      manuallyAssigned.push(item);
    } else {
      autoAssigned.push(item);
    }
  }

  return { autoAssigned, manuallyAssigned };
}

/** Whether HR has confirmed all sent offboarding documents */
export function countUnconfirmedOffboardingDocuments(
  docs: EmployeeDocumentStatusItem[]
): number {
  return docs.filter(
    (doc) => doc.assignmentSentAt && !isDocumentHrConfirmed(doc.status)
  ).length;
}
