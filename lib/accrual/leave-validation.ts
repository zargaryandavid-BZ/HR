import { prisma } from "@/lib/prisma";
import { DEFAULT_ACCRUAL_POLICY, HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import {
  canUseLeave,
  daysUntilLeaveEligible,
  getLeaveEligibleDate,
} from "@/lib/accrual/eligibility";

export { canUseLeave, daysUntilLeaveEligible, getLeaveEligibleDate };

/** Resolve accrual policy for an employee from their position */
export async function getEmployeeAccrualPolicy(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      startDate: true,
      position: { include: { accrualPolicy: true } },
    },
  });

  if (!employee) return null;

  return {
    hireDate: employee.startDate ?? new Date(),
    policy: employee.position?.accrualPolicy ?? DEFAULT_ACCRUAL_POLICY,
  };
}

/** Block leave requests for accrued types during the waiting period */
export async function validateAccruedLeaveEligibility(
  employeeId: string,
  leaveTypeSlug: string | null | undefined
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (leaveTypeSlug !== "pto" && leaveTypeSlug !== "sick") {
    return { ok: true };
  }

  const context = await getEmployeeAccrualPolicy(employeeId);
  if (!context) return { ok: false, message: "Employee not found" };

  if (canUseLeave(context.hireDate, context.policy.usableAfterDays)) {
    return { ok: true };
  }

  const days = daysUntilLeaveEligible(context.hireDate, context.policy.usableAfterDays);
  const eligibleDate = getLeaveEligibleDate(context.hireDate, context.policy.usableAfterDays);
  const formatted = eligibleDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    ok: false,
    message: `Leave is not available yet. Available in ${days} day${days !== 1 ? "s" : ""} (eligible ${formatted}).`,
  };
}

/** Remaining accrued hours available to request (after used/pending days) */
export function getRemainingAccruedHours(balance: {
  balanceHours: number;
  usedDays: number;
  pendingDays: number;
}): number {
  const reservedHours = (balance.usedDays + balance.pendingDays) * HOURS_PER_WORK_DAY;
  return Math.max(0, balance.balanceHours - reservedHours);
}
