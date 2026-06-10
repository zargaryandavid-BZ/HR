/** Parse YYYY-MM-DD from a form input as UTC noon (avoids timezone day-shift) */
export function parseFormDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date");
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Format an ISO or date-only string for display without local timezone shift */
export function formatStoredDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const normalized =
    dateStr.length === 10 ? `${dateStr}T12:00:00.000Z` : dateStr;
  return new Date(normalized).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

/** Calendar date range label, e.g. "Jun 16 – Jun 18" */
export function formatStoredDateRange(start: string, end: string): string {
  const startLabel = formatStoredDate(start);
  const endLabel = formatStoredDate(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (start === end) return startLabel;
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const endShort =
    startYear === endYear
      ? formatStoredDate(end)
      : endLabel;
  return `${startLabel} – ${endShort}`;
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
