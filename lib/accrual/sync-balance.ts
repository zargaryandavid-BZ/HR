import type { AccrualPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hoursToAllowanceDays, ensureAccrualBalance } from "@/lib/accrual";
import { resolveHoursWorkedForAccrual } from "@/lib/accrual/hours-estimate";
import { resolveAccrualPolicy } from "@/lib/accrual/resolve-policy";

type AccrualPolicyLike = Pick<
  AccrualPolicy,
  "hoursWorkedPerAccrual" | "hoursEarnedPerAccrual" | "ptoAccrualCapHours" | "sickAccrualCapHours"
>;

function calculateEarnedHours(totalHoursWorked: number, policy: AccrualPolicyLike): number {
  return (totalHoursWorked / policy.hoursWorkedPerAccrual) * policy.hoursEarnedPerAccrual;
}

/**
 * Recalculate PTO/sick balanceHours from hours worked (time entries or schedule estimate).
 * Leave usage is tracked separately via usedDays/pendingDays on approved/pending requests.
 */
export async function syncAccrualBalancesFromHoursWorked(employeeId: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { position: { include: { accrualPolicy: true } } },
  });

  if (!employee) return;

  const policy = resolveAccrualPolicy(employee);
  const hoursWorked = await resolveHoursWorkedForAccrual(employeeId);
  if (hoursWorked <= 0) return;

  const hoursEarned = calculateEarnedHours(hoursWorked, policy);
  const year = new Date().getFullYear();
  const now = new Date();

  for (const leaveTypeSlug of ["pto", "sick"] as const) {
    const leaveType = await prisma.leaveType.findFirst({
      where: { slug: leaveTypeSlug, isActive: true },
    });
    if (!leaveType) continue;

    const cap =
      leaveTypeSlug === "pto" ? policy.ptoAccrualCapHours : policy.sickAccrualCapHours;
    const cappedHours = Math.min(hoursEarned, cap);

    const balance = await ensureAccrualBalance(employeeId, leaveType.id, year);

    const hoursWorkedChanged =
      Math.abs(balance.accrualHoursWorked - hoursWorked) > 0.01;
    const balanceChanged = Math.abs(balance.balanceHours - cappedHours) > 0.01;

    if (!hoursWorkedChanged && !balanceChanged) continue;

    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        balanceHours: cappedHours,
        allowance: hoursToAllowanceDays(cappedHours),
        accrualHoursEarned: cappedHours,
        accrualHoursWorked: hoursWorked,
        lastAccrualAt: now,
      },
    });
  }
}
