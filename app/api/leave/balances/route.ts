import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";

/** Returns all employees with their leave balances for all active leave types */
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "HR_ADMIN"]);

    const currentYear = new Date().getFullYear();

    const [employees, leaveTypes] = await Promise.all([
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
          leaveBalances: {
            where: { year: currentYear },
            select: {
              id: true,
              leaveTypeId: true,
              allowance: true,
              usedDays: true,
              pendingDays: true,
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const data = employees.map((emp) => {
      const balancesByType = Object.fromEntries(
        leaveTypes.map((lt) => {
          const bal = emp.leaveBalances.find((b) => b.leaveTypeId === lt.id);
          return [
            lt.id,
            {
              balanceId: bal?.id ?? null,
              allowance: bal?.allowance ?? lt.defaultDays,
              usedDays: bal?.usedDays ?? 0,
              pendingDays: bal?.pendingDays ?? 0,
              remainingDays: (bal?.allowance ?? lt.defaultDays) - (bal?.usedDays ?? 0),
            },
          ];
        })
      );

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        jobTitle: emp.jobTitle,
        department: emp.department,
        avatarInitials: `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase(),
        balances: balancesByType,
      };
    });

    return Response.json(apiSuccess({ employees: data, leaveTypes }));
  } catch {
    return apiError("Server error", "Failed to fetch leave balances", 500);
  }
}
