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

/**
 * Hours available for accrual — actual time entries when present,
 * otherwise estimated from weekly schedule × weeks employed.
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

  if (!employee) return 0;

  const fromEntries = await getTotalHoursFromTimeEntries(employeeId);
  if (fromEntries > 0) return fromEntries;

  if (!employee.startDate) return 0;

  const daysEmployed = Math.floor(
    (Date.now() - employee.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysEmployed <= 0) return 0;

  const weeklyHours = getWeeklyScheduledHours(
    employee.scheduleType,
    employee.scheduleConfig
  );
  const weeksEmployed = daysEmployed / 7;
  return weeksEmployed * weeklyHours;
}
