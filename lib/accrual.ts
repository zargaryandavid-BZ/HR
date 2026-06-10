import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ACCRUAL_POLICY,
  HOURS_PER_WORK_DAY,
  type AccrualLeaveSlug,
} from "@/lib/accrual/constants";

export interface AccrualResult {
  hoursEarned: number;
  newBalance: number;
  cappedAt: number | null;
}

import {
  canUseLeave,
  daysUntilLeaveEligible,
  getLeaveEligibleDate,
} from "@/lib/accrual/eligibility";

/** Sync day-based allowance from hour balance for legacy leave UI */
export function hoursToAllowanceDays(balanceHours: number): number {
  return balanceHours / HOURS_PER_WORK_DAY;
}

/** Ensure a current-year leave balance row exists for an accrual leave type */
export async function ensureAccrualBalance(
  employeeId: string,
  leaveTypeId: string,
  year = new Date().getFullYear()
) {
  return prisma.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
    },
    create: {
      employeeId,
      leaveTypeId,
      year,
      allowance: 0,
      usedDays: 0,
      pendingDays: 0,
      balanceHours: 0,
      accrualHoursEarned: 0,
      accrualHoursWorked: 0,
      yearStartBalance: 0,
    },
    update: {},
  });
}

/** Process accrual for an employee based on hours worked since last check */
export async function processAccrual(
  employeeId: string,
  leaveTypeSlug: AccrualLeaveSlug,
  newHoursWorked: number
): Promise<AccrualResult | null> {
  if (newHoursWorked <= 0) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      position: { include: { accrualPolicy: true } },
    },
  });

  if (!employee?.position?.accrualPolicy) return null;

  const policy = employee.position.accrualPolicy;
  const leaveType = await prisma.leaveType.findFirst({
    where: { slug: leaveTypeSlug, isActive: true },
  });
  if (!leaveType) return null;

  const year = new Date().getFullYear();
  const balance = await ensureAccrualBalance(employeeId, leaveType.id, year);

  const cap =
    leaveTypeSlug === "pto"
      ? policy.ptoAccrualCapHours
      : policy.sickAccrualCapHours;

  if (balance.balanceHours >= cap) {
    return { hoursEarned: 0, newBalance: balance.balanceHours, cappedAt: cap };
  }

  const rawHoursEarned =
    (newHoursWorked / policy.hoursWorkedPerAccrual) * policy.hoursEarnedPerAccrual;

  const availableCapRoom = cap - balance.balanceHours;
  const hoursEarned = Math.min(rawHoursEarned, availableCapRoom);
  const newBalance = balance.balanceHours + hoursEarned;

  await prisma.$transaction([
    prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        balanceHours: newBalance,
        allowance: hoursToAllowanceDays(newBalance),
        accrualHoursEarned: { increment: hoursEarned },
        accrualHoursWorked: { increment: newHoursWorked },
        lastAccrualAt: new Date(),
      },
    }),
    prisma.leaveAccrualLog.create({
      data: {
        employeeId,
        leaveTypeId: leaveType.id,
        type: "ACCRUAL",
        hoursWorked: newHoursWorked,
        hoursEarned,
        balanceAfter: newBalance,
      },
    }),
  ]);

  return {
    hoursEarned,
    newBalance,
    cappedAt: hoursEarned < rawHoursEarned ? cap : null,
  };
}

/** Apply a manual hour adjustment with audit log */
export async function manualAdjustBalance({
  employeeId,
  leaveTypeId,
  hours,
  type,
  note,
  adjustedById,
}: {
  employeeId: string;
  leaveTypeId: string;
  hours: number;
  type: "ADD" | "DEDUCT";
  note: string;
  adjustedById: string;
}) {
  const year = new Date().getFullYear();
  const balance = await ensureAccrualBalance(employeeId, leaveTypeId, year);
  const delta = type === "ADD" ? hours : -hours;
  const newBalance = Math.max(0, balance.balanceHours + delta);

  await prisma.$transaction([
    prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        balanceHours: newBalance,
        allowance: hoursToAllowanceDays(newBalance),
        adjustedById,
        adjustmentReason: note,
      },
    }),
    prisma.leaveAccrualLog.create({
      data: {
        employeeId,
        leaveTypeId,
        type: "MANUAL_ADJUSTMENT",
        hoursEarned: newBalance - balance.balanceHours,
        balanceAfter: newBalance,
        note,
        adjustedById,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: adjustedById,
        action: "LEAVE_BALANCE_MANUAL_ADJUSTMENT",
        targetId: balance.id,
        targetTable: "LeaveBalance",
        oldValue: { balanceHours: balance.balanceHours },
        newValue: { balanceHours: newBalance, type, hours, note },
        reason: note,
      },
    }),
  ]);

  return { newBalance };
}

/** Create default accrual policy for a position if missing */
export async function ensureDefaultAccrualPolicy(positionId: string) {
  return prisma.accrualPolicy.upsert({
    where: { positionId },
    create: { positionId, ...DEFAULT_ACCRUAL_POLICY },
    update: {},
  });
}
