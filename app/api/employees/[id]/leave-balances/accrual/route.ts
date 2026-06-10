import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canUseLeave,
  daysUntilLeaveEligible,
  getLeaveEligibleDate,
} from "@/lib/accrual/eligibility";
import { DEFAULT_ACCRUAL_POLICY } from "@/lib/accrual/constants";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";

type RouteParams = { params: Promise<{ id: string }> };

/** Returns accrual detail for an employee's PTO and sick balances */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const { id: employeeId } = await params;
    const year = new Date().getFullYear();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        startDate: true,
        position: { include: { accrualPolicy: true } },
        leaveBalances: {
          where: { year },
          include: { leaveType: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!employee) return apiError("Not found", "Employee not found", 404);

    const policy = employee.position?.accrualPolicy ?? DEFAULT_ACCRUAL_POLICY;
    const waitDays = "usableAfterDays" in policy ? policy.usableAfterDays : 90;
    const hireDate = employee.startDate ?? employee.leaveBalances[0]?.createdAt ?? new Date();
    const eligible = canUseLeave(hireDate, waitDays);
    const daysUntil = daysUntilLeaveEligible(hireDate, waitDays);
    const eligibleDate = getLeaveEligibleDate(hireDate, waitDays);

    const accrualTypes = employee.leaveBalances.filter(
      (b) => b.leaveType.slug === "pto" || b.leaveType.slug === "sick"
    );

    const balances = accrualTypes.map((balance) => {
      const slug = balance.leaveType.slug as "pto" | "sick";
      const cap =
        slug === "pto" ? policy.ptoAccrualCapHours : policy.sickAccrualCapHours;
      const rolloverCap = slug === "pto" ? policy.ptoRolloverCapHours : null;
      const hoursToNextAccrual =
        policy.hoursWorkedPerAccrual -
        (balance.accrualHoursWorked % policy.hoursWorkedPerAccrual);

      return {
        leaveTypeId: balance.leaveTypeId,
        leaveTypeName: balance.leaveType.name,
        slug,
        balanceHours: balance.balanceHours,
        balanceDays: balance.balanceHours / HOURS_PER_WORK_DAY,
        accrualCapHours: cap,
        capPercent: cap > 0 ? Math.round((balance.balanceHours / cap) * 100) : 0,
        accrualHoursEarned: balance.accrualHoursEarned,
        accrualHoursWorked: balance.accrualHoursWorked,
        usedDays: balance.usedDays,
        usedHours: balance.usedDays * HOURS_PER_WORK_DAY,
        hoursWorkedPerAccrual: policy.hoursWorkedPerAccrual,
        hoursEarnedPerAccrual: policy.hoursEarnedPerAccrual,
        hoursToNextAccrual,
        rolloverCapHours: rolloverCap,
        fullRollover: slug === "sick",
        lastAccrualAt: balance.lastAccrualAt?.toISOString() ?? null,
      };
    });

    return Response.json(
      apiSuccess({
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
        },
        eligibility: {
          canUseLeave: eligible,
          daysUntilEligible: daysUntil,
          eligibleDate: eligibleDate.toISOString(),
          waitDays,
        },
        balances,
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch accrual detail", 500);
  }
}
