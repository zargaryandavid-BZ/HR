import { prisma } from "@/lib/prisma";
import {
  buildDayBreakSchedule,
  getTodayWeekday,
  parseWeekdayParam,
} from "@/lib/breaks/schedule-helpers";
import { migrateLegacyFixedConfig } from "@/lib/schedule";
import type { BreakScheduleResponse } from "@/lib/breaks/types";

export type { BreakScheduleResponse };

/** Load employee break schedule for a specific weekday */
export async function getEmployeeBreakSchedule(
  employeeId: string,
  weekdayParam?: string | null
): Promise<BreakScheduleResponse | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      scheduleType: true,
      scheduleConfig: true,
      mealBreak1WaiverEnabled: true,
      mealBreak2WaiverEnabled: true,
    },
  });

  if (!employee) return null;

  if (employee.scheduleType !== "FIXED") {
    return null;
  }

  const weekday = parseWeekdayParam(weekdayParam) ?? getTodayWeekday();
  const scheduleConfig = migrateLegacyFixedConfig(employee.scheduleConfig);
  const day = buildDayBreakSchedule(weekday, scheduleConfig);

  if (day.unavailable || !day.breaks) {
    return {
      noShiftToday: true,
      dayName: day.dayName,
      weekday: day.weekday,
      shiftStart: null,
      shiftEnd: null,
      totalHours: 0,
      restBreakCount: 0,
      restBreakMinutes: 10,
      restBreakTimes: [],
      mealBreakCount: 0,
      mealBreakMinutes: 30,
      mealBreak1LatestStart: null,
      mealBreak2LatestStart: null,
      mealBreak1WaiverEnabled: employee.mealBreak1WaiverEnabled,
      mealBreak2WaiverEnabled: employee.mealBreak2WaiverEnabled,
      mealBreak1CanBeWaived: false,
      mealBreak2CanBeWaived: false,
      totalPaidBreakMinutes: 0,
      totalUnpaidBreakMinutes: 0,
    };
  }

  const breaks = day.breaks;
  return {
    noShiftToday: false,
    dayName: day.dayName,
    weekday: day.weekday,
    shiftStart: day.shiftStart,
    shiftEnd: day.shiftEnd,
    totalHours: breaks.totalHours,
    restBreakCount: breaks.restBreakCount,
    restBreakMinutes: breaks.restBreakMinutes,
    restBreakTimes: breaks.restBreakTimes,
    mealBreakCount: breaks.mealBreakCount,
    mealBreakMinutes: breaks.mealBreakMinutes,
    mealBreak1LatestStart: breaks.mealBreak1LatestStart,
    mealBreak2LatestStart: breaks.mealBreak2LatestStart,
    mealBreak1WaiverEnabled: employee.mealBreak1WaiverEnabled,
    mealBreak2WaiverEnabled: employee.mealBreak2WaiverEnabled,
    mealBreak1CanBeWaived: breaks.mealBreak1CanBeWaived,
    mealBreak2CanBeWaived: breaks.mealBreak2CanBeWaived,
    totalPaidBreakMinutes: breaks.totalPaidBreakMinutes,
    totalUnpaidBreakMinutes: breaks.totalUnpaidBreakMinutes,
  };
}
