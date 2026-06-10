import { toDateOnlyString } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { getEmployeeAccrualPolicy } from "@/lib/accrual/leave-validation";
import {
  canUseLeave,
  daysUntilLeaveEligible,
  getLeaveEligibleDate,
} from "@/lib/accrual/eligibility";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { getRemainingAccruedHours } from "@/lib/accrual/leave-validation";

/** Returns leave balances, leave requests, and company holidays for the employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const currentYear = new Date().getFullYear();

    const [balances, requests, holidays, activeLeaveTypes] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { employeeId: session.employeeId, year: currentYear },
        include: { leaveType: { select: { name: true } } },
        orderBy: { leaveType: { name: "asc" } },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: session.employeeId },
        include: { leaveType: { select: { name: true } } },
        orderBy: { startDate: "desc" },
        take: 50,
      }),
      prisma.holiday.findMany({
        where: {
          OR: [
            { isCompanyWide: true },
            { employeeId: session.employeeId },
          ],
        },
        orderBy: { date: "asc" },
      }),
      prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, defaultDays: true, isPaid: true, accrualType: true },
      }),
    ]);

    const accrualContext = await getEmployeeAccrualPolicy(session.employeeId);
    const policy = accrualContext?.policy;
    const hireDate = accrualContext?.hireDate ?? new Date();
    const waitDays = policy?.usableAfterDays ?? 90;
    const leaveEligible = canUseLeave(hireDate, waitDays);
    const daysUntilEligible = daysUntilLeaveEligible(hireDate, waitDays);
    const eligibleDate = getLeaveEligibleDate(hireDate, waitDays);

    // Build a map of existing balance records
    const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));

    // Ensure every active leave type has a balance row (0/0 if no record yet)
    const mergedBalances = activeLeaveTypes.map((lt) => {
      const b = balanceMap.get(lt.id);
      const isAccrued = lt.accrualType === "ACCRUED" && (lt.slug === "pto" || lt.slug === "sick");
      const cap =
        lt.slug === "pto"
          ? (policy?.ptoAccrualCapHours ?? 120)
          : lt.slug === "sick"
            ? (policy?.sickAccrualCapHours ?? 80)
            : null;
      const balanceHours = b?.balanceHours ?? 0;
      const remainingHours = b
        ? getRemainingAccruedHours(b)
        : 0;

      return b
        ? {
            id: b.id,
            leaveTypeId: b.leaveTypeId,
            leaveTypeName: lt.name,
            slug: lt.slug,
            isPaid: lt.isPaid,
            isAccrued,
            allowance: isAccrued ? balanceHours / HOURS_PER_WORK_DAY : b.allowance,
            usedDays: b.usedDays,
            pendingDays: b.pendingDays,
            remaining: isAccrued
              ? remainingHours / HOURS_PER_WORK_DAY
              : b.allowance - b.usedDays - b.pendingDays,
            balanceHours,
            accrualCapHours: cap,
            capPercent:
              cap && cap > 0 ? Math.round((balanceHours / cap) * 100) : null,
            accrualHoursWorked: b.accrualHoursWorked,
            hoursWorkedPerAccrual: policy?.hoursWorkedPerAccrual ?? 30,
            hoursEarnedPerAccrual: policy?.hoursEarnedPerAccrual ?? 1,
            ptoRolloverCapHours:
              lt.slug === "pto" ? (policy?.ptoRolloverCapHours ?? 40) : null,
            fullRollover: lt.slug === "sick",
            canUseLeave: isAccrued ? leaveEligible : true,
            daysUntilEligible: isAccrued && !leaveEligible ? daysUntilEligible : 0,
            eligibleDate: isAccrued ? eligibleDate.toISOString() : null,
          }
        : {
            id: `virtual-${lt.id}`,
            leaveTypeId: lt.id,
            leaveTypeName: lt.name,
            slug: lt.slug,
            isPaid: lt.isPaid,
            isAccrued,
            allowance: lt.defaultDays,
            usedDays: 0,
            pendingDays: 0,
            remaining: lt.defaultDays,
            balanceHours: 0,
            accrualCapHours: cap,
            capPercent: 0,
            accrualHoursWorked: 0,
            hoursWorkedPerAccrual: policy?.hoursWorkedPerAccrual ?? 30,
            hoursEarnedPerAccrual: policy?.hoursEarnedPerAccrual ?? 1,
            ptoRolloverCapHours:
              lt.slug === "pto" ? (policy?.ptoRolloverCapHours ?? 40) : null,
            fullRollover: lt.slug === "sick",
            canUseLeave: isAccrued ? leaveEligible : true,
            daysUntilEligible: isAccrued && !leaveEligible ? daysUntilEligible : 0,
            eligibleDate: isAccrued ? eligibleDate.toISOString() : null,
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
    return apiError("Server error", "Failed to fetch leave data", 500);
  }
}
