import { format, isValid, parseISO } from "date-fns";

/** Standard calendar date label, e.g. "Feb 4 2025" */
export const DISPLAY_DATE_FORMAT = "MMM d yyyy";

/** Standard timestamp label, e.g. "Feb 4 2025 3:30 PM" */
export const DISPLAY_DATETIME_FORMAT = "MMM d yyyy h:mm a";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function calendarDateFromUtc(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function normalizeDateInput(value: Date | string): Date {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  if (DATE_ONLY_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return parseISO(trimmed);
}

function shouldUseUtcCalendar(value: Date | string, date: Date): boolean {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    return true;
  }
  if (typeof value === "string" && /T12:00:00/.test(value)) {
    return true;
  }
  return date.getUTCHours() === 12 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
}

function toCalendarDate(value: Date | string): Date {
  const date = normalizeDateInput(value);
  if (!isValid(date)) return date;
  return shouldUseUtcCalendar(value, date) ? calendarDateFromUtc(date) : date;
}

/** Format a calendar date as "Feb 4 2025" */
export function formatDisplayDate(value: Date | string): string {
  const date = toCalendarDate(value);
  if (!isValid(date)) return String(value);
  return format(date, DISPLAY_DATE_FORMAT);
}

/** Format month and day only, e.g. "Feb 4" */
export function formatDisplayMonthDay(value: Date | string): string {
  const date = toCalendarDate(value);
  if (!isValid(date)) return String(value);
  return format(date, "MMM d");
}

/** Format a timestamp as "Feb 4 2025 3:30 PM" */
export function formatDisplayDateTime(value: Date | string): string {
  const date = normalizeDateInput(value);
  if (!isValid(date)) return String(value);
  return format(date, DISPLAY_DATETIME_FORMAT);
}

/** Format an ISO or date-only string for display without local timezone shift */
export function formatStoredDate(
  dateStr: string,
  options: { monthDayOnly?: boolean } = {}
): string {
  if (options.monthDayOnly) {
    return formatDisplayMonthDay(dateStr);
  }
  return formatDisplayDate(dateStr);
}

/** Calendar date range label, e.g. "Feb 4 – Feb 8 2025" */
export function formatStoredDateRange(start: string, end: string): string {
  const startKey = start.slice(0, 10);
  const endKey = end.slice(0, 10);
  if (startKey === endKey) return formatDisplayDate(startKey);

  const startYear = startKey.slice(0, 4);
  const endYear = endKey.slice(0, 4);
  if (startYear === endYear) {
    return `${formatDisplayMonthDay(startKey)} – ${formatDisplayDate(endKey)}`;
  }
  return `${formatDisplayDate(startKey)} – ${formatDisplayDate(endKey)}`;
}

/** Format with weekday, e.g. "Mon Feb 4 2025" */
export function formatDisplayDateWithWeekday(value: Date | string): string {
  const date = toCalendarDate(value);
  if (!isValid(date)) return String(value);
  return format(date, "EEE MMM d yyyy");
}

/** Format with full weekday, e.g. "Monday, Feb 4 2025" */
export function formatDisplayWeekdayDate(value: Date | string): string {
  const date = toCalendarDate(value);
  if (!isValid(date)) return String(value);
  return format(date, "EEEE, MMM d yyyy");
}

/** Parse YYYY-MM-DD from a form input as UTC noon (avoids timezone day-shift) */
export function parseFormDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date");
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Serialize a form date for API responses as YYYY-MM-DD */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse a stored YYYY-MM-DD value for local calendar iteration */
export function parseStoredDateLocal(dateStr: string): Date {
  const key = dateStr.slice(0, 10);
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
