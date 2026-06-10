import { getEmployeeBreakSchedule } from "@/lib/breaks/service";
import { breakResponseToDaySchedule, type DayBreakSchedule } from "@/lib/breaks/schedule-helpers";

const WEEKDAY_QUERY_PARAMS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Load saved weekly break schedules for an employee (server-only) */
export async function getSavedWeeklyBreakSchedules(
  employeeId: string
): Promise<DayBreakSchedule[] | null> {
  const rows = [];

  for (const weekday of WEEKDAY_QUERY_PARAMS) {
    const row = await getEmployeeBreakSchedule(employeeId, weekday);
    if (!row) return null;
    rows.push(row);
  }

  return rows.map(breakResponseToDaySchedule);
}
