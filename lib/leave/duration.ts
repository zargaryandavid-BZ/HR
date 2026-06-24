import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { formatLeaveBalanceHours, formatLeaveBalanceValue } from "@/lib/utils";

/** Convert requested hours to fractional working days for balance tracking */
export function hoursToWorkingDays(hours: number): number {
  return hours / HOURS_PER_WORK_DAY;
}

/** Human-readable leave amount for tables and previews */
export function formatLeaveRequestAmount(
  workingDays: number,
  workingHours?: number | null
): string {
  if (workingHours != null && workingHours > 0 && workingHours < HOURS_PER_WORK_DAY) {
    return `${formatLeaveBalanceHours(workingHours)} hrs`;
  }
  if (workingDays < 1 && workingDays > 0) {
    const hours = workingDays * HOURS_PER_WORK_DAY;
    return `${formatLeaveBalanceHours(hours)} hrs`;
  }
  return `${formatLeaveBalanceValue(workingDays)} day${workingDays === 1 ? "" : "s"}`;
}
