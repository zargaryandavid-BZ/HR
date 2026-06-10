import type { WeekdayKey } from "@/lib/schedule";

/** Break schedule API response — safe to import from client components */
export type BreakScheduleResponse = {
  noShiftToday: boolean;
  dayName: string;
  weekday: WeekdayKey;
  shiftStart: string | null;
  shiftEnd: string | null;
  totalHours: number;
  restBreakCount: number;
  restBreakMinutes: number;
  restBreakTimes: string[];
  mealBreakCount: number;
  mealBreakMinutes: number;
  mealBreak1LatestStart: string | null;
  mealBreak2LatestStart: string | null;
  mealBreak1WaiverEnabled: boolean;
  mealBreak2WaiverEnabled: boolean;
  mealBreak1CanBeWaived: boolean;
  mealBreak2CanBeWaived: boolean;
  totalPaidBreakMinutes: number;
  totalUnpaidBreakMinutes: number;
};
