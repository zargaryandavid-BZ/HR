import { calculateBreaks } from "@/lib/breaks";
import { getPrimaryShift, resolveCustomSchedule } from "@/lib/breaks/schedule-helpers";
import { prisma } from "@/lib/prisma";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/lib/schedule";
import type { ScheduleType } from "@prisma/client";

/** Sum scheduled work hours across one week from a fixed schedule config */
export function getWeeklyScheduledHours(
  scheduleType: ScheduleType,
  scheduleConfig: unknown
): number {
  if (scheduleType !== "FIXED") return 40;

  const config = resolveCustomSchedule(scheduleConfig);
  if (!config) return 40;

  let weeklyHours = 0;
  for (const day of WEEKDAY_KEYS) {
    const primary = getPrimaryShift(config.days[day as WeekdayKey] ?? []);
    if (primary) {
      weeklyHours += calculateBreaks(primary.start, primary.end).totalHours;
    }
  }

  return weeklyHours > 0 ? weeklyHours : 40;
}

/** Total hours from completed session-based time entries */
export async function getTotalHoursFromTimeEntries(employeeId: string): Promise<number> {
  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId,
      status: { in: ["COMPLETED", "APPROVED"] },
    },
    select: { hoursWorked: true },
  });

  return entries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);
}

/** Estimate hours from hire date × weekly schedule (Mon–Fri, etc.) */
export function estimateHoursFromSchedule(
  startDate: Date,
  scheduleType: ScheduleType,
  scheduleConfig: unknown,
  asOf: Date = new Date()
): number {
  const daysEmployed = Math.floor(
    (asOf.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysEmployed <= 0) return 0;

  const weeklyHours = getWeeklyScheduledHours(scheduleType, scheduleConfig);
  return (daysEmployed / 7) * weeklyHours;
}

/**
 * Hours available for accrual.
 * Uses clock entries when they reflect most of expected tenure; otherwise falls back
 * to schedule estimate so long-tenured employees aren't stuck at 0 when clock history is sparse.
 */
export async function resolveHoursWorkedForAccrual(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      startDate: true,
      scheduleType: true,
      scheduleConfig: true,
    },
  });

  if (!employee?.startDate) return 0;

  const scheduleEstimate = estimateHoursFromSchedule(
    employee.startDate,
    employee.scheduleType,
    employee.scheduleConfig
  );

  const fromEntries = await getTotalHoursFromTimeEntries(employeeId);
  if (fromEntries <= 0) return scheduleEstimate;

  // Sparse clock data (e.g. only a few recent punches) should not block tenure-based accrual
  if (scheduleEstimate > 0 && fromEntries < scheduleEstimate * 0.8) {
    return scheduleEstimate;
  }

  return fromEntries;
}
