import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { formatDateRange } from "@/lib/leave/working-days";
import { formatEmployeeName } from "@/lib/utils";

const APPROVER_ROLES: Role[] = ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"];

type NotificationItem = {
  id: string;
  eventType: string;
  contentSnapshot: {
    message?: string;
    href?: string;
    leaveRequestId?: string;
    actionLabel?: string;
  } | null;
  createdAt: string;
  isActionRequired?: boolean;
};

/** Fetch in-app notifications and pending leave alerts for the current user */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

    const notifications: NotificationItem[] = [];
    let unreadCount = 0;

    if (session.employeeId) {
      const employeeWhere = {
        employeeId: session.employeeId,
        channel: "IN_APP" as const,
        ...(unreadOnly && { status: { not: "READ" as const } }),
      };

      const excludeLeavePending = APPROVER_ROLES.includes(session.role);

      const [employeeNotifications, employeeUnreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: {
            ...employeeWhere,
            ...(excludeLeavePending && {
              eventType: { not: "LEAVE_PENDING_APPROVAL" },
            }),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        prisma.notification.count({
          where: {
            employeeId: session.employeeId,
            channel: "IN_APP",
            status: { not: "READ" },
            ...(excludeLeavePending && {
              eventType: { not: "LEAVE_PENDING_APPROVAL" },
            }),
          },
        }),
      ]);

      notifications.push(
        ...employeeNotifications.map((n) => ({
          id: n.id,
          eventType: n.eventType,
          contentSnapshot: n.contentSnapshot as NotificationItem["contentSnapshot"],
          createdAt: n.createdAt.toISOString(),
        }))
      );
      unreadCount += employeeUnreadCount;
    }

    if (APPROVER_ROLES.includes(session.role)) {
      const deptFilter =
        session.role === "MANAGER" && session.employee?.departmentId
          ? { employee: { departmentId: session.employee.departmentId } }
          : {};

      const leaveHref =
        session.role === "MANAGER" ? "/manager/leave-approvals" : "/admin/leave";

      const [pendingLeave, pendingCount] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: { status: "PENDING", ...deptFilter },
          include: {
            employee: {
              select: { firstName: true, lastName: true, preferredName: true },
            },
            leaveType: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        prisma.leaveRequest.count({
          where: { status: "PENDING", ...deptFilter },
        }),
      ]);

      const leaveAlerts: NotificationItem[] = pendingLeave.map((r) => ({
        id: `leave-pending-${r.id}`,
        eventType: "LEAVE_PENDING_APPROVAL",
        contentSnapshot: {
          message: `${formatEmployeeName(
            r.employee.firstName,
            r.employee.lastName,
            r.employee.preferredName
          )} submitted ${r.leaveType.name} for ${formatDateRange(r.startDate, r.endDate)} — needs approval`,
          href: leaveHref,
          leaveRequestId: r.id,
          actionLabel: "Review",
        },
        createdAt: r.createdAt.toISOString(),
        isActionRequired: true,
      }));

      notifications.unshift(...leaveAlerts);
      unreadCount += pendingCount;
    }

    const sorted = notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return Response.json(apiSuccess({ notifications: sorted, unreadCount }));
  } catch {
    return apiError("Server error", "Failed to fetch notifications", 500);
  }
}
