import {
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  startOfDay,
} from "date-fns";
import { formatStoredDate, formatStoredDateRange } from "@/lib/dates";

export const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-cyan-500",
];

/** Deterministic avatar background color from an employee id */
export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/** Progress bar and chip color based on completion percentage */
export function getProgressColor(percent: number): {
  bar: string;
  chip: string;
} {
  if (percent >= 70) {
    return { bar: "#639922", chip: "bg-[#EAF3DE] text-[#3B6D11]" };
  }
  if (percent >= 30) {
    return { bar: "#EF9F27", chip: "bg-[#FAEEDA] text-[#854F0B]" };
  }
  return { bar: "#E24B4A", chip: "bg-red-100 text-red-700" };
}

/** Parse optional ?month=YYYY-MM search param into a Date at month start */
export function parseViewMonth(monthParam?: string): Date {
  if (!monthParam) return startOfDay(new Date());
  const parsed = parse(monthParam, "yyyy-MM", new Date());
  return isValid(parsed) ? parsed : startOfDay(new Date());
}

/** Full header date, e.g. "Monday, Jun 9, 2026" */
export function formatHeaderDate(date: Date): string {
  return format(date, "EEEE, MMM d, yyyy");
}

/** Short date for KPI return label, e.g. "Returns Jun 12" */
export function formatReturnDate(date: Date): string {
  return `Returns ${format(date, "MMM d")}`;
}

/** Normalize a Date or ISO string to YYYY-MM-DD for timezone-safe formatting */
function toDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return value.toISOString().slice(0, 10);
}

/** Calendar day range label, e.g. "Jun 16 – Jun 18" */
export function formatShortDateRange(start: Date | string, end: Date | string): string {
  return formatStoredDateRange(toDateOnly(start), toDateOnly(end));
}

/** Write-up or document date label */
export function formatShortDate(date: Date | string): string {
  return formatStoredDate(toDateOnly(date), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole calendar days since a date (0 = today) */
export function daysSince(date: Date | string): number {
  const value = typeof date === "string" ? new Date(date) : date;
  return differenceInCalendarDays(startOfDay(new Date()), startOfDay(value));
}

/** Age chip label and color for unsigned document rows */
export function getDocumentAgeChip(assignedAt: Date | string): {
  label: string;
  className: string;
} {
  const days = daysSince(assignedAt);
  if (days === 0) {
    return { label: "Today", className: "bg-gray-100 text-gray-600 border-gray-200" };
  }
  if (days <= 2) {
    return {
      label: `${days} day${days !== 1 ? "s" : ""}`,
      className: "bg-amber-100 text-amber-700 border-amber-200",
    };
  }
  return {
    label: `${days} days overdue`,
    className: "bg-red-100 text-red-700 border-red-200",
  };
}
