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

/** Format a date range as "Jun 22 – Jun 24" */
export function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}
