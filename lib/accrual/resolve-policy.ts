import type { AccrualPolicy } from "@prisma/client";
import { DEFAULT_ACCRUAL_POLICY } from "@/lib/accrual/constants";

type AccrualPolicyLike = Pick<
  AccrualPolicy,
  | "hoursWorkedPerAccrual"
  | "hoursEarnedPerAccrual"
  | "ptoAccrualCapHours"
  | "ptoRolloverCapHours"
  | "sickAccrualCapHours"
  | "usableAfterDays"
>;

type EmployeeWithPolicy = {
  position?: { accrualPolicy: AccrualPolicy | null } | null;
};

/** Accrual policy from position, or company default when unassigned */
export function resolveAccrualPolicy(
  employee: EmployeeWithPolicy | null | undefined
): AccrualPolicyLike {
  return employee?.position?.accrualPolicy ?? DEFAULT_ACCRUAL_POLICY;
}
