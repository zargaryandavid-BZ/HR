import type { TimeEntry } from "@prisma/client";

/** Calculate total hours worked from paired clock-in / clock-out entries */
export function calculateHoursFromTimeEntries(entries: Pick<TimeEntry, "eventType" | "timestamp">[]): number {
  let totalMs = 0;
  let clockIn: Date | null = null;

  for (const entry of entries) {
    if (entry.eventType === "CLOCK_IN") {
      clockIn = entry.timestamp;
    } else if (entry.eventType === "CLOCK_OUT" && clockIn) {
      totalMs += entry.timestamp.getTime() - clockIn.getTime();
      clockIn = null;
    }
  }

  return Math.max(0, totalMs / (1000 * 60 * 60));
}

/** Calculate hours between a single clock-in and clock-out */
export function calculateHours(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}
