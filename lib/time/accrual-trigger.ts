import { processAccrual } from "@/lib/accrual";

/** Run PTO and sick accrual for newly approved/logged work hours */
export async function triggerAccrualForHoursWorked(
  employeeId: string,
  hoursWorked: number
) {
  if (hoursWorked <= 0) return;

  await Promise.all([
    processAccrual(employeeId, "pto", hoursWorked),
    processAccrual(employeeId, "sick", hoursWorked),
  ]);
}
