import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Prisma filter matching unacknowledged write-ups */
const unacknowledgedWriteUpWhere = {
  acknowledgedAt: null,
  employeeSignedAt: null,
} as const;

export type AdminDashboardKpis = Awaited<ReturnType<typeof fetchAdminDashboardKpis>>;

/** Load KPI metrics for the admin dashboard header cards */
export async function fetchAdminDashboardKpis() {
  noStore();
  const today = new Date();

  const [
    totalEmployees,
    activeEmployees,
    onLeaveToday,
    onLeaveTodayRequests,
    pendingLeaveCount,
    pendingWriteUpsCount,
    unsignedDocsCount,
    oldestUnsigned,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.leaveRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { endDate: true },
      orderBy: { endDate: "asc" },
      take: 1,
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.writeUp.count({ where: unacknowledgedWriteUpWhere }),
    prisma.documentAssignment.count({
      where: {
        signedAt: null,
        hrApprovedAt: null,
      },
    }),
    prisma.documentAssignment.findFirst({
      where: { signedAt: null },
      orderBy: { assignedAt: "asc" },
      select: { assignedAt: true },
    }),
  ]);

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees: totalEmployees - activeEmployees,
    onLeaveToday,
    earliestReturn: onLeaveTodayRequests[0]?.endDate ?? null,
    pendingApprovalsTotal: pendingLeaveCount + pendingWriteUpsCount,
    pendingLeaveCount,
    pendingWriteUpsCount,
    unsignedDocsCount,
    oldestUnsignedAssignedAt: oldestUnsigned?.assignedAt ?? null,
  };
}
