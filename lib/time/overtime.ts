/** Overtime hours breakdown for timesheet / payroll */
export type OvertimeBreakdown = {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
};

/** Whether overtime should be calculated and displayed for this employee */
export function isOvertimeTracked(isNonExempt: boolean): boolean {
  return isNonExempt;
}

/**
 * Apply FLSA exempt guard — exempt employees receive no OT/DT premium.
 * All worked hours remain as regular hours; OT and DT are zeroed.
 */
export function applyExemptOvertimeGuard(
  isNonExempt: boolean,
  breakdown: OvertimeBreakdown
): OvertimeBreakdown {
  if (isNonExempt) {
    return breakdown;
  }

  const totalWorked =
    breakdown.regularHours + breakdown.overtimeHours + breakdown.doubleTimeHours;

  return {
    regularHours: totalWorked,
    overtimeHours: 0,
    doubleTimeHours: 0,
  };
}
