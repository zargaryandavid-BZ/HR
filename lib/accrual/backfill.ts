import type { AccrualPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hoursToAllowanceDays, ensureAccrualBalance } from "@/lib/accrual";
import type { AccrualLeaveSlug } from "@/lib/accrual/constants";
import { resolveHoursWorkedForAccrual } from "@/lib/accrual/hours-estimate";

export type AccrualBackfillResult = {
  employeeId: string;
  name: string;
  status: string;
  hoursWorked?: number;
  ptoHours?: number;
  sickHours?: number;
};

/** Calculate earned accrual hours from total hours worked and policy */
function calculateEarnedHours(totalHoursWorked: number, policy: AccrualPolicy): number {
  return (totalHoursWorked / policy.hoursWorkedPerAccrual) * policy.hoursEarnedPerAccrual;
}

/** Backfill PTO and sick balances for one employee from worked/estimated hours */
export async function backfillEmployeeAccrual(
  employeeId: string
): Promise<AccrualBackfillResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: { include: { accrualPolicy: true } },
    },
  });

  if (!employee) {
    return { employeeId, name: "Unknown", status: "SKIPPED - employee not found" };
  }

  const policy = employee.position?.accrualPolicy;
  if (!policy) {
    return {
      employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      status: "SKIPPED - no accrual policy",
    };
  }

  const hoursWorked = await resolveHoursWorkedForAccrual(employeeId);
  if (hoursWorked <= 0) {
    return {
      employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      status: "SKIPPED - no hours to accrue",
    };
  }

  const hoursEarned = calculateEarnedHours(hoursWorked, policy);
  const year = new Date().getFullYear();
  const now = new Date();
  const results: Record<AccrualLeaveSlug, number> = { pto: 0, sick: 0 };

  for (const leaveTypeSlug of ["pto", "sick"] as const) {
    const leaveType = await prisma.leaveType.findFirst({
      where: { slug: leaveTypeSlug, isActive: true },
    });
    if (!leaveType) continue;

    const cap =
      leaveTypeSlug === "pto" ? policy.ptoAccrualCapHours : policy.sickAccrualCapHours;
    const cappedHours = Math.min(hoursEarned, cap);

    const balance = await ensureAccrualBalance(employeeId, leaveType.id, year);

    await prisma.$transaction([
      prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          balanceHours: cappedHours,
          allowance: hoursToAllowanceDays(cappedHours),
          accrualHoursEarned: cappedHours,
          accrualHoursWorked: hoursWorked,
          lastAccrualAt: now,
        },
      }),
      prisma.leaveAccrualLog.create({
        data: {
          employeeId,
          leaveTypeId: leaveType.id,
          type: "BALANCE_RESET",
          hoursWorked,
          hoursEarned: cappedHours,
          balanceAfter: cappedHours,
          note: `Backfill accrual: ${hoursWorked.toFixed(1)} hrs worked → ${cappedHours.toFixed(2)} hrs ${leaveTypeSlug.toUpperCase()} (capped at ${cap})`,
        },
      }),
    ]);

    results[leaveTypeSlug] = cappedHours;
  }

  return {
    employeeId,
    name: `${employee.firstName} ${employee.lastName}`,
    hoursWorked,
    ptoHours: results.pto,
    sickHours: results.sick,
    status: "BACKFILLED",
  };
}

/** Backfill accrual for all active employees with an accrual policy */
export async function backfillAllActiveEmployeeAccrual(): Promise<AccrualBackfillResult[]> {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const results: AccrualBackfillResult[] = [];
  for (const employee of employees) {
    results.push(await backfillEmployeeAccrual(employee.id));
  }
  return results;
}
