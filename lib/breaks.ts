export interface BreakEntitlement {
  totalHours: number;
  shiftStart: string;
  shiftEnd: string;
  restBreakCount: number;
  restBreakMinutes: number;
  restBreakTimes: string[];
  mealBreakCount: number;
  mealBreakMinutes: number;
  mealBreak1LatestStart: string | null;
  mealBreak2LatestStart: string | null;
  mealBreak1CanBeWaived: boolean;
  mealBreak2CanBeWaived: boolean;
  totalPaidBreakMinutes: number;
  totalUnpaidBreakMinutes: number;
}

/** Convert minutes since midnight to HH:MM (24h) */
function minutesToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Calculate California break entitlements from shift start/end times */
export function calculateBreaks(shiftStart: string, shiftEnd: string): BreakEntitlement {
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  const totalMinutes = endMinutes - startMinutes;
  const totalHours = totalMinutes / 60;

  let restBreakCount = 0;
  if (totalHours < 3.5) {
    restBreakCount = 0;
  } else if (totalHours <= 6) {
    restBreakCount = 1;
  } else if (totalHours <= 10) {
    restBreakCount = 2;
  } else {
    restBreakCount = 3;
  }

  const restBreakTimes: string[] = [];
  if (restBreakCount > 0) {
    const segmentMinutes = totalMinutes / (restBreakCount + 1);
    for (let i = 1; i <= restBreakCount; i++) {
      const breakMinute = startMinutes + Math.round(segmentMinutes * i);
      restBreakTimes.push(minutesToTime(breakMinute));
    }
  }

  let mealBreakCount = 0;
  let mealBreak1LatestStart: string | null = null;
  let mealBreak2LatestStart: string | null = null;

  if (totalHours <= 5) {
    mealBreakCount = 0;
  } else if (totalHours <= 10) {
    mealBreakCount = 1;
    mealBreak1LatestStart = minutesToTime(startMinutes + 5 * 60);
  } else {
    mealBreakCount = 2;
    mealBreak1LatestStart = minutesToTime(startMinutes + 5 * 60);
    mealBreak2LatestStart = minutesToTime(startMinutes + 10 * 60);
  }

  const mealBreak1CanBeWaived = totalHours <= 6;
  const mealBreak2CanBeWaived = totalHours <= 12 && mealBreakCount >= 2;

  return {
    totalHours,
    shiftStart,
    shiftEnd,
    restBreakCount,
    restBreakMinutes: 10,
    restBreakTimes,
    mealBreakCount,
    mealBreakMinutes: 30,
    mealBreak1LatestStart,
    mealBreak2LatestStart,
    mealBreak1CanBeWaived,
    mealBreak2CanBeWaived,
    totalPaidBreakMinutes: restBreakCount * 10,
    totalUnpaidBreakMinutes: mealBreakCount * 30,
  };
}
