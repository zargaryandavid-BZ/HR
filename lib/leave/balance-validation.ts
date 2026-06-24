import type { LeaveType } from "@prisma/client";
import { getRemainingAccruedHours } from "@/lib/accrual/leave-validation";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { formatLeaveBalanceValue, formatLeaveBalanceHours } from "@/lib/utils";
import type { ResolvedLeaveDuration } from "@/lib/leave/resolve-request-duration";

type LeaveBalanceRow = {
  balanceHours: number;
  usedDays: number;
  pendingDays: number;
  allowance: number;
};

/** Validate paid leave balance for a resolved request duration */
export function validateLeaveBalanceForRequest(
  leaveType: Pick<LeaveType, "slug" | "isPaid">,
  balance: LeaveBalanceRow,
  duration: ResolvedLeaveDuration
): { ok: true } | { ok: false; message: string } {
  if (!leaveType.isPaid) return { ok: true };

  const requestedHours =
    duration.workingHours ?? duration.workingDays * HOURS_PER_WORK_DAY;

  if (leaveType.slug === "pto" || leaveType.slug === "sick") {
    const remainingHours = getRemainingAccruedHours(balance);
    if (requestedHours > remainingHours) {
      return {
        ok: false,
        message: `Insufficient balance. You have ${formatLeaveBalanceHours(remainingHours)} hrs (${formatLeaveBalanceValue(remainingHours / HOURS_PER_WORK_DAY)} days) available.`,
      };
    }
    return { ok: true };
  }

  const remainingDays = balance.allowance - balance.usedDays - balance.pendingDays;
  if (duration.workingDays > remainingDays) {
    return {
      ok: false,
      message: `Insufficient balance. You have ${formatLeaveBalanceValue(remainingDays)} days available.`,
    };
  }

  return { ok: true };
}
