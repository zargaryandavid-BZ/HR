/** Check if an employee is past the waiting period and can use accrued leave */
export function canUseLeave(hireDate: Date, policyWaitDays = 90): boolean {
  const eligibleDate = new Date(hireDate);
  eligibleDate.setDate(eligibleDate.getDate() + policyWaitDays);
  return new Date() >= eligibleDate;
}

/** Days remaining until employee can use leave; 0 if already eligible */
export function daysUntilLeaveEligible(hireDate: Date, policyWaitDays = 90): number {
  const eligibleDate = new Date(hireDate);
  eligibleDate.setDate(eligibleDate.getDate() + policyWaitDays);
  const diff = eligibleDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Eligible date formatted for display */
export function getLeaveEligibleDate(hireDate: Date, policyWaitDays = 90): Date {
  const eligibleDate = new Date(hireDate);
  eligibleDate.setDate(eligibleDate.getDate() + policyWaitDays);
  return eligibleDate;
}
