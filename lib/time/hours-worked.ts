/** Calculate total hours worked for a session-based TimeEntry */
export function calculateHours(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

/** Calculate elapsed seconds from a start time to now */
export function elapsedSeconds(from: Date): number {
  return Math.floor((Date.now() - from.getTime()) / 1000);
}

/** Format total minutes as Xh:XXm (e.g. 1h:12m) */
export function formatMinutesAsHm(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = Math.abs(rounded % 60);
  return `${h}h:${String(m).padStart(2, "0")}m`;
}

/** Format decimal hours as Xh:XXm */
export function formatHoursAsHm(hours: number): string {
  return formatMinutesAsHm(hours * 60);
}

/** Format elapsed seconds as Xh:XXm */
export function formatSecondsAsHm(seconds: number): string {
  return formatMinutesAsHm(seconds / 60);
}

/** Format seconds as HH:MM:SS (live clocks with second precision) */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
