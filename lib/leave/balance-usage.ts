import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAccrualBalance } from "@/lib/accrual";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";

type DbClient = Prisma.TransactionClient | typeof prisma;

function isAccruedLeaveType(leaveType: {
  accrualType: string;
  slug: string | null;
}): boolean {
  return (
    leaveType.accrualType === "ACCRUED" &&
    (leaveType.slug === "pto" || leaveType.slug === "sick")
  );
}

/** Apply approved or pending leave usage to an employee balance row */
export async function applyLeaveUsageToBalance(
  {
    employeeId,
    leaveTypeId,
    year,
    workingDays,
    autoApprove,
    leaveType,
  }: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    workingDays: number;
    autoApprove: boolean;
    leaveType: {
      defaultDays: number;
      accrualType: string;
      slug: string | null;
    };
  },
  db: DbClient = prisma
) {
  const accrued = isAccruedLeaveType(leaveType);

  if (accrued) {
    const balance = await ensureAccrualBalance(employeeId, leaveTypeId, year);
    await db.leaveBalance.update({
      where: { id: balance.id },
      data: autoApprove
        ? { usedDays: { increment: workingDays } }
        : { pendingDays: { increment: workingDays } },
    });
    return;
  }

  if (autoApprove) {
    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: {
        employeeId,
        leaveTypeId,
        year,
        allowance: leaveType.defaultDays,
        usedDays: workingDays,
      },
      update: { usedDays: { increment: workingDays } },
    });
  } else {
    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: {
        employeeId,
        leaveTypeId,
        year,
        allowance: leaveType.defaultDays,
        pendingDays: workingDays,
      },
      update: { pendingDays: { increment: workingDays } },
    });
  }
}

/** Hours reserved against accrued balance for a leave request */
export function leaveRequestReservedHours(
  workingDays: number,
  workingHours: number | null
): number {
  return workingHours ?? workingDays * HOURS_PER_WORK_DAY;
}
