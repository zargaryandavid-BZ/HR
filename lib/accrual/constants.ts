/** Standard work-day length used to sync hour balances to day-based leave UI */
export const HOURS_PER_WORK_DAY = 8;

export type AccrualLeaveSlug = "pto" | "sick";

export const DEFAULT_ACCRUAL_POLICY = {
  hoursWorkedPerAccrual: 30,
  hoursEarnedPerAccrual: 1,
  ptoAccrualCapHours: 120,
  ptoRolloverCapHours: 40,
  sickAccrualCapHours: 80,
  usableAfterDays: 90,
} as const;
