import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatDateRange } from "./working-days";
import { formatEmployeeName } from "@/lib/utils";

type LeaveAuditPayload = {
  userId: string;
  action: string;
  targetId?: string;
  newValue?: Record<string, unknown>;
  reason?: string;
};

/** Append an audit log entry for leave actions */
export async function logLeaveAudit({
  userId,
  action,
  targetId,
  newValue,
  reason,
}: LeaveAuditPayload) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      targetId,
      targetTable: "LeaveRequest",
      newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      reason,
    },
  });
}

/** Send an in-app notification to an employee about their leave request */
export async function notifyLeaveStatusChange({
  employeeId,
  leaveTypeName,
  startDate,
  endDate,
  status,
  reviewNote,
  hrAdded = false,
}: {
  employeeId: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  status: "APPROVED" | "REJECTED" | "HR_ADDED";
  reviewNote?: string | null;
  hrAdded?: boolean;
}) {
  const dateRange = formatDateRange(startDate, endDate);

  let message = "";
  let eventType = "";

  if (status === "APPROVED" && hrAdded) {
    message = `HR has recorded ${leaveTypeName} for ${dateRange} on your behalf ✓`;
    eventType = "LEAVE_HR_ADDED";
  } else if (status === "APPROVED") {
    message = `Your ${leaveTypeName} request for ${dateRange} has been approved ✓`;
    eventType = "LEAVE_APPROVED";
  } else if (status === "REJECTED") {
    const reason = reviewNote ? `. Reason: ${reviewNote}` : "";
    message = `Your ${leaveTypeName} request for ${dateRange} was not approved${reason}`;
    eventType = "LEAVE_REJECTED";
  }

  if (!message) return;

  await prisma.notification.create({
    data: {
      employeeId,
      eventType,
      channel: "IN_APP",
      status: "SENT",
      sentAt: new Date(),
      contentSnapshot: { message },
    },
  });
}

/** Notify HR admins and department managers when an employee submits a leave request */
export async function notifyLeaveRequestSubmitted({
  leaveRequestId,
  employeeId,
  leaveTypeName,
  startDate,
  endDate,
}: {
  leaveRequestId: string;
  employeeId: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      departmentId: true,
    },
  });
  if (!employee) return;

  const dateRange = formatDateRange(startDate, endDate);
  const name = formatEmployeeName(
    employee.firstName,
    employee.lastName,
    employee.preferredName
  );
  const message = `${name} submitted ${leaveTypeName} for ${dateRange} — approval needed`;

  const hrUsers = await prisma.user.findMany({
    where: {
      role: { in: ["HR_ADMIN", "SUPER_ADMIN"] },
      employeeId: { not: null },
    },
    select: { employeeId: true },
  });

  const managers = employee.departmentId
    ? await prisma.user.findMany({
        where: {
          role: "MANAGER",
          employeeId: { not: null },
          employee: { departmentId: employee.departmentId },
        },
        select: { employeeId: true },
      })
    : [];

  const recipientIds = [
    ...new Set([
      ...hrUsers.map((u) => u.employeeId!),
      ...managers.map((u) => u.employeeId!),
    ]),
  ].filter((id) => id !== employeeId);

  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((recipientEmployeeId) => ({
      employeeId: recipientEmployeeId,
      eventType: "LEAVE_PENDING_APPROVAL",
      channel: "IN_APP" as const,
      status: "SENT" as const,
      sentAt: new Date(),
      contentSnapshot: {
        message,
        href: "/admin/leave",
        leaveRequestId,
      },
    })),
  });
}

/** Mark in-app leave approval notifications as read after a request is actioned */
export async function markLeaveApprovalNotificationsRead(leaveRequestId: string) {
  await prisma.notification.updateMany({
    where: {
      eventType: "LEAVE_PENDING_APPROVAL",
      contentSnapshot: {
        path: ["leaveRequestId"],
        equals: leaveRequestId,
      },
    },
    data: { status: "READ" },
  });
}
