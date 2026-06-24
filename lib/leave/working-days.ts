/** Calculate the number of working days between two dates (Mon–Fri, excluding holidays) */
export function calculateWorkingDays(
  start: Date,
  end: Date,
  holidayDates: Date[] = []
): number {
  const holidaySet = new Set(
    holidayDates.map((d) => d.toISOString().split("T")[0])
  );

  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);

  while (current <= endNorm) {
    const day = current.getDay();
    const dateStr = current.toISOString().split("T")[0];
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

import { formatStoredDateRange } from "@/lib/dates";

/** Format a date range as "Feb 4 – Feb 8 2025" */
export function formatDateRange(start: Date, end: Date): string {
  return formatStoredDateRange(
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10)
  );
}
