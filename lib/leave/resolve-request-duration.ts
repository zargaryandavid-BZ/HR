import { parseFormDate, toDateOnlyString } from "@/lib/dates";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { calculateWorkingDays } from "@/lib/leave/working-days";
import { hoursToWorkingDays } from "@/lib/leave/duration";

export type LeaveRequestMode = "days" | "hours";

export type LeaveRequestDurationInput = {
  startDate: string;
  endDate: string;
  requestMode?: LeaveRequestMode;
  durationHours?: number;
};

export type ResolvedLeaveDuration = {
  start: Date;
  end: Date;
  workingDays: number;
  workingHours: number | null;
};

export function resolveLeaveRequestDuration(
  input: LeaveRequestDurationInput,
  holidayDates: Date[]
): ResolvedLeaveDuration | { error: string } {
  const start = parseFormDate(input.startDate);
  const end = parseFormDate(input.endDate);
  const mode: LeaveRequestMode =
    input.requestMode ?? (input.durationHours != null ? "hours" : "days");

  if (mode === "hours") {
    const hours = input.durationHours;
    if (hours == null || Number.isNaN(hours)) {
      return { error: "Enter how many hours to request" };
    }
    if (hours <= 0) {
      return { error: "Hours must be greater than 0" };
    }
    if (hours > HOURS_PER_WORK_DAY) {
      return { error: `Maximum ${HOURS_PER_WORK_DAY} hours per request` };
    }
    if (toDateOnlyString(start) !== toDateOnlyString(end)) {
      return { error: "Hour-based requests must use a single date" };
    }

    const workingDaysOnDate = calculateWorkingDays(start, end, holidayDates);
    if (workingDaysOnDate === 0) {
      return { error: "Selected date is not a working day" };
    }

    return {
      start,
      end,
      workingDays: hoursToWorkingDays(hours),
      workingHours: hours,
    };
  }

  if (end < start) {
    return { error: "End date must be on or after start date" };
  }

  const workingDays = calculateWorkingDays(start, end, holidayDates);
  if (workingDays <= 0) {
    return { error: "No working days in selected range" };
  }

  return {
    start,
    end,
    workingDays,
    workingHours: null,
  };
}
