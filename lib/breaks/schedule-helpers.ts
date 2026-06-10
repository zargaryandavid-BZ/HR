import { calculateBreaks, type BreakEntitlement } from "@/lib/breaks";
import type { BreakScheduleResponse } from "@/lib/breaks/types";
import {
  migrateLegacyFixedConfig,
  SCHEDULE_DISPLAY_ORDER,
  WEEKDAY_FULL_LABELS,
  type CustomScheduleConfig,
  type TimeSlot,
  type WeekdayKey,
} from "@/lib/schedule";

export type DayBreakSchedule = {
  weekday: WeekdayKey;
  dayName: string;
  unavailable: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
  breaks: BreakEntitlement | null;
};

const WEEKDAY_PARAM_MAP: Record<string, WeekdayKey> = {
  mon: "MON",
  monday: "MON",
  tue: "TUE",
  tuesday: "TUE",
  wed: "WED",
  wednesday: "WED",
  thu: "THU",
  thursday: "THU",
  fri: "FRI",
  friday: "FRI",
  sat: "SAT",
  saturday: "SAT",
  sun: "SUN",
  sunday: "SUN",
};

const JS_DAY_TO_WEEKDAY: WeekdayKey[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Map break schedule API row to day break schedule for grouping UI */
export function breakResponseToDaySchedule(row: BreakScheduleResponse): DayBreakSchedule {
  if (row.noShiftToday || !row.shiftStart || !row.shiftEnd) {
    return {
      weekday: row.weekday,
      dayName: row.dayName,
      unavailable: true,
      shiftStart: null,
      shiftEnd: null,
      breaks: null,
    };
  }

  const breaks: BreakEntitlement = {
    totalHours: row.totalHours,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    restBreakCount: row.restBreakCount,
    restBreakMinutes: row.restBreakMinutes,
    restBreakTimes: row.restBreakTimes,
    mealBreakCount: row.mealBreakCount,
    mealBreakMinutes: row.mealBreakMinutes,
    mealBreak1LatestStart: row.mealBreak1LatestStart,
    mealBreak2LatestStart: row.mealBreak2LatestStart,
    mealBreak1CanBeWaived: row.mealBreak1CanBeWaived,
    mealBreak2CanBeWaived: row.mealBreak2CanBeWaived,
    totalPaidBreakMinutes: row.totalPaidBreakMinutes,
    totalUnpaidBreakMinutes: row.totalUnpaidBreakMinutes,
  };

  return {
    weekday: row.weekday,
    dayName: row.dayName,
    unavailable: false,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    breaks,
  };
}

/** Format HH:MM as 12-hour display (e.g. 9:30 AM) */
export function formatBreakTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Parse weekday query param to WeekdayKey */
export function parseWeekdayParam(value: string | null | undefined): WeekdayKey | null {
  if (!value) return null;
  return WEEKDAY_PARAM_MAP[value.trim().toLowerCase()] ?? null;
}

/** Get today's weekday key */
export function getTodayWeekday(): WeekdayKey {
  return JS_DAY_TO_WEEKDAY[new Date().getDay()];
}

/** Resolve custom schedule config from stored JSON */
export function resolveCustomSchedule(scheduleConfig: unknown): CustomScheduleConfig | null {
  if (!scheduleConfig || typeof scheduleConfig !== "object") return null;
  const migrated = migrateLegacyFixedConfig(scheduleConfig);
  return migrated.type === "CUSTOM" ? migrated : null;
}

/** Pick the longest shift slot for a day (used when multiple slots exist) */
export function getPrimaryShift(slots: TimeSlot[]): TimeSlot | null {
  if (!slots.length) return null;
  return slots.reduce((longest, slot) => {
    const longestHours = calculateBreaks(longest.start, longest.end).totalHours;
    const slotHours = calculateBreaks(slot.start, slot.end).totalHours;
    return slotHours > longestHours ? slot : longest;
  });
}

/** Build break schedule for one weekday */
export function buildDayBreakSchedule(
  weekday: WeekdayKey,
  scheduleConfig: unknown
): DayBreakSchedule {
  const config = resolveCustomSchedule(scheduleConfig);
  const slots = config?.days[weekday] ?? [];
  const primary = getPrimaryShift(slots);

  if (!primary) {
    return {
      weekday,
      dayName: WEEKDAY_FULL_LABELS[weekday],
      unavailable: true,
      shiftStart: null,
      shiftEnd: null,
      breaks: null,
    };
  }

  const breaks = calculateBreaks(primary.start, primary.end);
  return {
    weekday,
    dayName: WEEKDAY_FULL_LABELS[weekday],
    unavailable: false,
    shiftStart: primary.start,
    shiftEnd: primary.end,
    breaks,
  };
}

/** Build break schedules for all seven days */
export function buildWeeklyBreakSchedule(scheduleConfig: unknown): DayBreakSchedule[] {
  return SCHEDULE_DISPLAY_ORDER.map((weekday) =>
    buildDayBreakSchedule(weekday, scheduleConfig)
  );
}

/** Signature for grouping identical consecutive day schedules */
export function dayBreakSignature(day: DayBreakSchedule): string {
  if (day.unavailable || !day.breaks) return "unavailable";
  return JSON.stringify({
    shiftStart: day.shiftStart,
    shiftEnd: day.shiftEnd,
    restBreakCount: day.breaks.restBreakCount,
    mealBreakCount: day.breaks.mealBreakCount,
    mealBreak1LatestStart: day.breaks.mealBreak1LatestStart,
    mealBreak2LatestStart: day.breaks.mealBreak2LatestStart,
  });
}

export type GroupedDayBreak = {
  label: string;
  days: DayBreakSchedule[];
  representative: DayBreakSchedule;
  sameAsPrevious: boolean;
};

/** Group consecutive days with identical break schedules */
export function groupWeeklyBreakDays(days: DayBreakSchedule[]): GroupedDayBreak[] {
  const order: WeekdayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const ordered = order.map((key) => days.find((d) => d.weekday === key)!);

  const groups: GroupedDayBreak[] = [];
  let i = 0;

  while (i < ordered.length) {
    const current = ordered[i];
    const sig = dayBreakSignature(current);
    const run: DayBreakSchedule[] = [current];
    let j = i + 1;

    while (j < ordered.length && dayBreakSignature(ordered[j]) === sig) {
      run.push(ordered[j]);
      j++;
    }

    const firstLabel =
      run.length === 1
        ? current.weekday.slice(0, 3)
        : `${run[0].weekday.slice(0, 3)}–${run[run.length - 1].weekday.slice(0, 3)}`;

    groups.push({
      label: firstLabel,
      days: run,
      representative: current,
      sameAsPrevious: groups.length > 0 && sig === dayBreakSignature(groups[groups.length - 1].representative),
    });

    i = j;
  }

  return groups;
}

/** Determine waiver eligibility from the longest workday in the week */
export function getWaiverEligibilityFromWeek(
  days: DayBreakSchedule[]
): { mealBreak1CanBeWaived: boolean; mealBreak2CanBeWaived: boolean } {
  const worked = days.filter((d) => !d.unavailable && d.breaks);
  if (!worked.length) {
    return { mealBreak1CanBeWaived: false, mealBreak2CanBeWaived: false };
  }

  const longest = worked.reduce((max, day) =>
    (day.breaks?.totalHours ?? 0) > (max.breaks?.totalHours ?? 0) ? day : max
  );

  return {
    mealBreak1CanBeWaived: longest.breaks?.mealBreak1CanBeWaived ?? false,
    mealBreak2CanBeWaived: longest.breaks?.mealBreak2CanBeWaived ?? false,
  };
}

/** Check if current time is within 30 minutes before a meal deadline */
export function isMealDeadlineApproaching(deadline: string | null): boolean {
  if (!deadline) return false;
  const now = new Date();
  const [dh, dm] = deadline.split(":").map(Number);
  const deadlineDate = new Date(now);
  deadlineDate.setHours(dh, dm, 0, 0);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const thirtyMin = 30 * 60 * 1000;
  return diffMs <= thirtyMin && diffMs >= -thirtyMin;
}
