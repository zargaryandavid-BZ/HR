import { prisma } from "@/lib/prisma";
import type { DocumentRepositoryScope, Prisma } from "@prisma/client";
import type { AssignmentTag } from "@/lib/documents/constants";
import { formatEmployeeName } from "@/lib/utils";
import {
  employeeNeedsSignedUpload,
  isDocumentHrConfirmed,
} from "@/lib/individual-settings/constants";
import { getEmployeeDocumentsWithStatus } from "@/lib/individual-settings/documents";

type NotificationPayload = {
  employeeId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
};

/** Notify HR admins that a signed document awaits approval */
export async function notifyHrAdminsDocumentAwaitingApproval({
  employeeId,
  documentId,
  documentTitle,
}: {
  employeeId: string;
  documentId: string;
  documentTitle: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, preferredName: true },
  });

  const employeeName = employee
    ? formatEmployeeName(employee.firstName, employee.lastName, employee.preferredName)
    : "An employee";

  const hrUsers = await prisma.user.findMany({
    where: {
      role: { in: ["HR_ADMIN", "SUPER_ADMIN"] },
      employeeId: { not: null },
    },
    select: { employeeId: true },
  });

  if (!hrUsers.length) return;

  await Promise.all(
    hrUsers.map((user) =>
      createInAppNotification({
        employeeId: user.employeeId!,
        eventType: "DOCUMENT_AWAITING_HR_APPROVAL",
        message: `${employeeName}'s "${documentTitle}" is signed and awaiting HR approval`,
        metadata: {
          employeeId,
          documentId,
          documentTitle,
          href: `/admin/employees/${employeeId}`,
        },
      })
    )
  );
}

/** Send a document reminder to the employee, or HR if already signed */
export async function sendDocumentCompletionReminder({
  employeeId,
  documentId,
  documentTitle,
}: {
  employeeId: string;
  documentId: string;
  documentTitle: string;
}) {
  const docs = await getEmployeeDocumentsWithStatus(employeeId, { sentOnly: true });
  const allDocs = [...docs.companyWide, ...docs.assigned];
  const docStatus = allDocs.find((doc) => doc.id === documentId);

  if (!docStatus) {
    return { error: "not_assigned" as const };
  }

  if (isDocumentHrConfirmed(docStatus.status)) {
    return { error: "already_confirmed" as const };
  }

  if (employeeNeedsSignedUpload(docStatus.status)) {
    await createInAppNotification({
      employeeId,
      eventType: "DOCUMENT_REMINDER",
      message: `Please complete and return: ${documentTitle}`,
      metadata: { documentId, documentTitle, href: "/employee/dashboard" },
    });
  } else {
    await notifyHrAdminsDocumentAwaitingApproval({
      employeeId,
      documentId,
      documentTitle,
    });
  }

  return { error: null };
}

/** Create an in-app notification for an employee */
export async function createInAppNotification({
  employeeId,
  eventType,
  message,
  metadata = {},
}: NotificationPayload) {
  await prisma.notification.create({
    data: {
      employeeId,
      eventType,
      channel: "IN_APP",
      status: "SENT",
      sentAt: new Date(),
      contentSnapshot: { message, ...metadata },
    },
  });
}

/** Notify multiple employees with the same in-app message */
export async function notifyEmployees(
  employeeIds: string[],
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  if (!employeeIds.length) return;

  await prisma.notification.createMany({
    data: employeeIds.map((employeeId) => ({
      employeeId,
      eventType,
      channel: "IN_APP" as const,
      status: "SENT" as const,
      sentAt: new Date(),
      contentSnapshot: { message, ...metadata },
    })),
  });
}

type AuditPayload = {
  userId: string;
  action: string;
  targetId?: string;
  targetTable?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
};

/** Write an audit log entry for document actions */
export async function logDocumentAudit({
  userId,
  action,
  targetId,
  targetTable = "Sop",
  oldValue,
  newValue,
  reason,
}: AuditPayload) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      targetId,
      targetTable,
      oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      reason,
    },
  });
}

/** Count unacknowledged documents for an employee */
export async function getUnacknowledgedDocumentCount(employeeId: string): Promise<number> {
  const assignments = await prisma.documentAssignment.findMany({
    where: { employeeId, sentAt: { not: null } },
    select: {
      signedFileUrl: true,
      acknowledgedAt: true,
      sop: {
        select: {
          version: true,
          acknowledgments: {
            where: { employeeId },
            select: { sopVersion: true },
            orderBy: { sopVersion: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return assignments.filter((assignment) => {
    const latestAck = assignment.sop.acknowledgments[0];
    const hasSignedCopy = !!assignment.signedFileUrl;
    return (
      !hasSignedCopy ||
      !latestAck ||
      latestAck.sopVersion < assignment.sop.version
    );
  }).length;
}

/** Resolve employee IDs from position and department links */
export async function getLinkedEmployeeIds(
  positionIds: string[],
  departmentIds: string[]
): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        ...(positionIds.length ? [{ positionId: { in: positionIds } }] : []),
        ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
      ],
    },
    select: { id: true },
  });
  return employees.map((e) => e.id);
}

/** Resolve all active employee IDs for company-wide documents */
export async function getAllActiveEmployeeIds(): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  return employees.map((e) => e.id);
}

/** Sync employee assignments to a target set, notifying newly added employees */
async function syncAssignmentsToTarget({
  sopId,
  targetIds,
  assignedById,
  documentTitle,
}: {
  sopId: string;
  targetIds: string[];
  assignedById: string;
  documentTitle: string;
}): Promise<{ added: number; removed: number }> {
  const targetSet = new Set(targetIds);

  const existing = await prisma.documentAssignment.findMany({
    where: { sopId, isOffboarding: false },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((a) => a.employeeId));

  const toAdd = [...targetSet].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !targetSet.has(id));

  await prisma.$transaction([
    ...toRemove.map((employeeId) =>
      prisma.documentAssignment.deleteMany({
        where: { sopId, employeeId, isOffboarding: false },
      })
    ),
    ...toAdd.map((employeeId) =>
      prisma.documentAssignment.create({
        data: {
          sopId,
          employeeId,
          assignedById,
          assignedManually: false,
          isOffboarding: false,
          sentAt: null,
        },
      })
    ),
  ]);

  return { added: toAdd.length, removed: toRemove.length };
}

/** Sync company-wide document assignments to all active employees */
export async function syncCompanyWideAssignments({
  sopId,
  assignedById,
  documentTitle,
}: {
  sopId: string;
  assignedById: string;
  documentTitle: string;
}) {
  const targetIds = await getAllActiveEmployeeIds();
  return syncAssignmentsToTarget({ sopId, targetIds, assignedById, documentTitle });
}

/** Sync position-specific document links and employee assignments */
export async function syncPositionSpecificAssignments({
  sopId,
  positionIds,
  departmentIds,
  employeeIds,
  assignedById,
  documentTitle,
}: {
  sopId: string;
  positionIds: string[];
  departmentIds: string[];
  employeeIds: string[];
  assignedById: string;
  documentTitle: string;
}) {
  await prisma.$transaction([
    prisma.documentPositionLink.deleteMany({ where: { documentId: sopId } }),
    ...positionIds.map((positionId) =>
      prisma.documentPositionLink.create({
        data: { documentId: sopId, positionId },
      })
    ),
    ...departmentIds.map((departmentId) =>
      prisma.documentPositionLink.create({
        data: { documentId: sopId, departmentId },
      })
    ),
    prisma.sop.update({
      where: { id: sopId },
      data: { positionIds, departmentIds },
    }),
  ]);

  const linkedIds = await getLinkedEmployeeIds(positionIds, departmentIds);
  const targetIds = [...new Set([...linkedIds, ...employeeIds])];

  return syncAssignmentsToTarget({ sopId, targetIds, assignedById, documentTitle });
}

/** Sync document assignments based on repository scope */
export async function syncDocumentScopeAssignments({
  sopId,
  scope,
  positionIds = [],
  departmentIds = [],
  employeeIds = [],
  assignedById,
  documentTitle,
}: {
  sopId: string;
  scope: DocumentRepositoryScope;
  positionIds?: string[];
  departmentIds?: string[];
  employeeIds?: string[];
  assignedById: string;
  documentTitle: string;
}) {
  if (scope === "COMPANY_WIDE") {
    await prisma.documentPositionLink.deleteMany({ where: { documentId: sopId } });
    await prisma.sop.update({
      where: { id: sopId },
      data: { scope, positionIds: [], departmentIds: [] },
    });
    return syncCompanyWideAssignments({ sopId, assignedById, documentTitle });
  }

  return syncPositionSpecificAssignments({
    sopId,
    positionIds,
    departmentIds,
    employeeIds,
    assignedById,
    documentTitle,
  });
}

/** Build assignment tag labels from position links */
export function buildAssignmentTags(
  links: Array<{
    positionId: string | null;
    departmentId: string | null;
    position?: { name: string } | null;
    department?: { name: string } | null;
  }>
): AssignmentTag[] {
  const tags: AssignmentTag[] = [];
  for (const link of links) {
    if (link.positionId && link.position) {
      tags.push({ id: link.positionId, label: link.position.name, kind: "position" });
    }
    if (link.departmentId && link.department) {
      tags.push({ id: link.departmentId, label: link.department.name, kind: "department" });
    }
  }
  return tags;
}

const documentInclude = {
  _count: { select: { assignments: true } },
  positionLinks: {
    include: {
      position: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

/** Serialize a Sop record for API responses */
export function serializeDocument(
  doc: {
    id: string;
    title: string;
    description: string;
    documentType: string;
    scope: DocumentRepositoryScope;
    version: number;
    fileUrl: string;
    isActive: boolean;
    status: string;
    updatedAt: Date;
    createdAt: Date;
    departmentIds?: string[];
    positionIds?: string[];
    _count?: { assignments: number };
    positionLinks?: Array<{
      positionId: string | null;
      departmentId: string | null;
      position?: { name: string } | null;
      department?: { name: string } | null;
    }>;
  },
  extra?: { fileName?: string | null }
) {
  const departmentIds = doc.departmentIds ?? [];
  const positionIds = doc.positionIds ?? [];
  const assignmentTags = doc.positionLinks
    ? buildAssignmentTags(doc.positionLinks)
    : [];

  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    documentType: doc.documentType,
    scope: doc.scope,
    version: doc.version,
    fileUrl: doc.fileUrl,
    isActive: doc.isActive,
    status: doc.status,
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    assignedCount: doc._count?.assignments ?? 0,
    departmentIds,
    positionIds,
    assignmentTags,
    ...extra,
  };
}

export { documentInclude };
