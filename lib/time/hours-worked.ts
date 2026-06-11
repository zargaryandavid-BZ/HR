/** Calculate total hours worked for a session-based TimeEntry */
export function calculateHours(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

/** Calculate elapsed seconds from a start time to now */
export function elapsedSeconds(from: Date): number {
  return Math.floor((Date.now() - from.getTime()) / 1000);
}

/** Format seconds as HH:MM:SS */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
