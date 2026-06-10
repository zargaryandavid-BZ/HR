export const WEEKDAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Display order for weekly schedule UI (Sunday → Saturday) */
export const SCHEDULE_DISPLAY_ORDER: WeekdayKey[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export type TimeSlot = { start: string; end: string };

export type CustomScheduleConfig = {
  type: "CUSTOM";
  days: Record<WeekdayKey, TimeSlot[]>;
};

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  MON: "M",
  TUE: "T",
  WED: "W",
  THU: "T",
  FRI: "F",
  SAT: "S",
  SUN: "S",
};

export const WEEKDAY_FULL_LABELS: Record<WeekdayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

/** Phone numbers — digits with optional leading + and common formatting */
export const PHONE_REGEX = /^\+?[0-9\s\-()]{7,15}$/;

/** Default per-day fixed schedule (Mon–Fri 9–5, Sat/Sun off) */
export function getDefaultCustomSchedule(): CustomScheduleConfig {
  const weekdaySlot: TimeSlot[] = [{ start: "09:00", end: "17:00" }];
  return {
    type: "CUSTOM",
    days: {
      MON: [...weekdaySlot],
      TUE: [...weekdaySlot],
      WED: [...weekdaySlot],
      THU: [...weekdaySlot],
      FRI: [...weekdaySlot],
      SAT: [],
      SUN: [],
    },
  };
}

/** Convert HH:mm to minutes since midnight for comparisons */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Check end is strictly after start */
export function isEndAfterStart(start: string, end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(start);
}

/** Detect overlapping time slots on the same day */
export function slotsOverlap(slots: TimeSlot[]): boolean {
  if (slots.length < 2) return false;
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (timeToMinutes(sorted[i].end) > timeToMinutes(sorted[i + 1].start)) {
      return true;
    }
  }
  return false;
}

/** Validate a custom schedule config; returns error message or null */
export function validateCustomSchedule(config: CustomScheduleConfig): string | null {
  const hasAvailableDay = WEEKDAY_KEYS.some((day) => config.days[day].length > 0);
  if (!hasAvailableDay) {
    return "At least one day must be available";
  }

  for (const day of WEEKDAY_KEYS) {
    const slots = config.days[day];
    for (const slot of slots) {
      if (!isEndAfterStart(slot.start, slot.end)) {
        return `${WEEKDAY_FULL_LABELS[day]}: end time must be after start time`;
      }
    }
    if (slotsOverlap(slots)) {
      return `${WEEKDAY_FULL_LABELS[day]}: time slots must not overlap`;
    }
  }

  return null;
}

/** Build 30-minute time options for dropdowns (06:00 – 23:30) */
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 6; h < 24; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m > 30) continue;
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

const LEGACY_DAY_MAP: Record<number, WeekdayKey> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

/** Convert legacy FIXED scheduleConfig to CUSTOM format */
export function migrateLegacyFixedConfig(config: unknown): CustomScheduleConfig {
  const defaults = getDefaultCustomSchedule();

  if (!config || typeof config !== "object") return defaults;

  const c = config as Record<string, unknown>;

  if (c.type === "CUSTOM" && c.days && typeof c.days === "object") {
    return c as CustomScheduleConfig;
  }

  if (c.type === "FIXED") {
    const startTime = (c.startTime as string) ?? "09:00";
    const endTime = (c.endTime as string) ?? "17:00";
    const workingDays = (c.workingDays as number[]) ?? [1, 2, 3, 4, 5];
    const slot: TimeSlot = { start: startTime, end: endTime };

    const days = { ...defaults.days };
    for (const key of WEEKDAY_KEYS) {
      days[key] = [];
    }
    for (const dayNum of workingDays) {
      const key = LEGACY_DAY_MAP[dayNum];
      if (key) days[key] = [{ ...slot }];
    }
    return { type: "CUSTOM", days };
  }

  return defaults;
}

/** Strip invalid characters while typing */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d\s\-()+]/g, "");
}

/** Normalize phone on blur — keep leading +, strip all other non-digits */
export function normalizePhoneOnBlur(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}
