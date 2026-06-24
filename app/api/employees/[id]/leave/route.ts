import { getSession } from "@/lib/auth";
import { toDateOnlyString } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Returns leave balances, leave requests, and holidays for a specific employee.
 * Used by the HR portal-preview so it renders identically to the employee's own view.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const currentYear = new Date().getFullYear();

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const [balances, requests, holidays, activeLeaveTypes] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { employeeId: id, year: currentYear },
        include: { leaveType: { select: { name: true } } },
        orderBy: { leaveType: { name: "asc" } },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: id },
        include: { leaveType: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      }),
      prisma.holiday.findMany({
        where: {
          OR: [{ isCompanyWide: true }, { employeeId: id }],
        },
        orderBy: { date: "asc" },
      }),
      prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));
    const mergedBalances = activeLeaveTypes.map((lt) => {
      const b = balanceMap.get(lt.id);
      return b
        ? {
            id: b.id,
            leaveTypeId: b.leaveTypeId,
            leaveTypeName: lt.name,
            allowance: b.allowance,
            usedDays: b.usedDays,
            pendingDays: b.pendingDays,
            remaining: b.allowance - b.usedDays - b.pendingDays,
          }
        : {
            id: `virtual-${lt.id}`,
            leaveTypeId: lt.id,
            leaveTypeName: lt.name,
            allowance: lt.defaultDays,
            usedDays: 0,
            pendingDays: 0,
            remaining: lt.defaultDays,
          };
    });

    return Response.json(
      apiSuccess({
        balances: mergedBalances,
        requests: requests.map((r) => ({
          id: r.id,
          leaveTypeName: r.leaveType.name,
          leaveTypeId: r.leaveTypeId,
          startDate: toDateOnlyString(r.startDate),
          endDate: toDateOnlyString(r.endDate),
          workingDays: r.workingDays,
          workingHours: r.workingHours,
          status: r.status,
          notes: r.notes,
          submittedAt: r.submittedAt.toISOString(),
        })),
        holidays: holidays.map((h) => ({
          id: h.id,
          name: h.name,
          date: h.date.toISOString(),
          isCompanyWide: h.isCompanyWide,
        })),
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch employee leave data", 500);
  }
}
