import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";

/** Returns summary leave stats: pending, on leave today, approved this month, upcoming */
export async function GET() {
  try {
    const session = await requireRole(["SUPER_ADMIN", "HR_ADMIN", "MANAGER"]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const deptFilter =
      session.role === "MANAGER" && session.employee?.departmentId
        ? { employee: { departmentId: session.employee.departmentId } }
        : {};

    const [pendingCount, onLeaveTodayCount, approvedThisMonthCount, upcomingCount] =
      await Promise.all([
        prisma.leaveRequest.count({
          where: { status: "PENDING", ...deptFilter },
        }),
        prisma.leaveRequest.count({
          where: {
            status: "APPROVED",
            startDate: { lte: now },
            endDate: { gte: now },
            ...deptFilter,
          },
        }),
        prisma.leaveRequest.count({
          where: {
            status: "APPROVED",
            createdAt: { gte: monthStart, lte: monthEnd },
            ...deptFilter,
          },
        }),
        prisma.leaveRequest.count({
          where: {
            status: { in: ["PENDING", "APPROVED"] },
            startDate: { gte: now, lte: in30Days },
            ...deptFilter,
          },
        }),
      ]);

    return Response.json(
      apiSuccess({ pendingCount, onLeaveTodayCount, approvedThisMonthCount, upcomingCount })
    );
  } catch {
    return apiError("Server error", "Failed to fetch leave stats", 500);
  }
}
