/** US federal holiday record for seeding */
export type FederalHolidayInput = {
  name: string;
  date: Date;
  isCompanyWide: true;
  employeeId: null;
  isPaid: true;
  isRecurringAnnually: false;
};

const FEDERAL_HOLIDAY_NAMES = {
  newYears: "New Year's Day",
  mlk: "Martin Luther King Jr. Day",
  presidents: "Presidents' Day",
  memorial: "Memorial Day",
  juneteenth: "Juneteenth National Independence Day",
  independence: "Independence Day",
  labor: "Labor Day",
  columbus: "Columbus Day",
  veterans: "Veterans Day",
  thanksgiving: "Thanksgiving Day",
  christmas: "Christmas Day",
} as const;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Nth occurrence of a weekday in a month (weekday: 0=Sun … 6=Sat) */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = utcDate(year, month, day);
    if (date.getUTCDay() === weekday) {
      count++;
      if (count === n) return date;
    }
  }

  throw new Error(`Could not find weekday ${weekday} occurrence ${n} in ${year}-${month + 1}`);
}

/** Last occurrence of a weekday in a month */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  for (let day = daysInMonth; day >= 1; day--) {
    const date = utcDate(year, month, day);
    if (date.getUTCDay() === weekday) return date;
  }

  throw new Error(`Could not find last weekday ${weekday} in ${year}-${month + 1}`);
}

/** Saturday → Friday; Sunday → Monday */
function observeFixedHoliday(year: number, month: number, day: number): Date {
  const date = utcDate(year, month, day);
  const dow = date.getUTCDay();

  if (dow === 6) return utcDate(year, month, day - 1);
  if (dow === 0) return utcDate(year, month, day + 1);
  return date;
}

function toHolidayRecord(name: string, date: Date): FederalHolidayInput {
  return {
    name,
    date,
    isCompanyWide: true,
    employeeId: null,
    isPaid: true,
    isRecurringAnnually: false,
  };
}

/** Calculate all 11 US federal holidays for a given year */
export function generateFederalHolidaysForYear(year: number): FederalHolidayInput[] {
  return [
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.newYears, observeFixedHoliday(year, 0, 1)),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.mlk, nthWeekdayOfMonth(year, 0, 1, 3)),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.presidents, nthWeekdayOfMonth(year, 1, 1, 3)),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.memorial, lastWeekdayOfMonth(year, 4, 1)),
    toHolidayRecord(
      FEDERAL_HOLIDAY_NAMES.juneteenth,
      observeFixedHoliday(year, 5, 19)
    ),
    toHolidayRecord(
      FEDERAL_HOLIDAY_NAMES.independence,
      observeFixedHoliday(year, 6, 4)
    ),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.labor, nthWeekdayOfMonth(year, 8, 1, 1)),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.columbus, nthWeekdayOfMonth(year, 9, 1, 2)),
    toHolidayRecord(
      FEDERAL_HOLIDAY_NAMES.veterans,
      observeFixedHoliday(year, 10, 11)
    ),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.thanksgiving, nthWeekdayOfMonth(year, 10, 4, 4)),
    toHolidayRecord(FEDERAL_HOLIDAY_NAMES.christmas, observeFixedHoliday(year, 11, 25)),
  ];
}

/** Explicit 2025–2027 dates (observed dates where applicable) for prisma seed */
export const FEDERAL_HOLIDAYS_2025_2027: FederalHolidayInput[] = [
  // 2025
  toHolidayRecord("New Year's Day", utcDate(2025, 0, 1)),
  toHolidayRecord("Martin Luther King Jr. Day", utcDate(2025, 0, 20)),
  toHolidayRecord("Presidents' Day", utcDate(2025, 1, 17)),
  toHolidayRecord("Memorial Day", utcDate(2025, 4, 26)),
  toHolidayRecord("Juneteenth National Independence Day", utcDate(2025, 5, 19)),
  toHolidayRecord("Independence Day", utcDate(2025, 6, 4)),
  toHolidayRecord("Labor Day", utcDate(2025, 8, 1)),
  toHolidayRecord("Columbus Day", utcDate(2025, 9, 13)),
  toHolidayRecord("Veterans Day", utcDate(2025, 10, 11)),
  toHolidayRecord("Thanksgiving Day", utcDate(2025, 10, 27)),
  toHolidayRecord("Christmas Day", utcDate(2025, 11, 25)),
  // 2026
  toHolidayRecord("New Year's Day", utcDate(2026, 0, 1)),
  toHolidayRecord("Martin Luther King Jr. Day", utcDate(2026, 0, 19)),
  toHolidayRecord("Presidents' Day", utcDate(2026, 1, 16)),
  toHolidayRecord("Memorial Day", utcDate(2026, 4, 25)),
  toHolidayRecord("Juneteenth National Independence Day", utcDate(2026, 5, 19)),
  toHolidayRecord("Independence Day", utcDate(2026, 6, 3)),
  toHolidayRecord("Labor Day", utcDate(2026, 8, 7)),
  toHolidayRecord("Columbus Day", utcDate(2026, 9, 12)),
  toHolidayRecord("Veterans Day", utcDate(2026, 10, 11)),
  toHolidayRecord("Thanksgiving Day", utcDate(2026, 10, 26)),
  toHolidayRecord("Christmas Day", utcDate(2026, 11, 25)),
  // 2027
  toHolidayRecord("New Year's Day", utcDate(2027, 0, 1)),
  toHolidayRecord("Martin Luther King Jr. Day", utcDate(2027, 0, 18)),
  toHolidayRecord("Presidents' Day", utcDate(2027, 1, 15)),
  toHolidayRecord("Memorial Day", utcDate(2027, 4, 31)),
  toHolidayRecord("Juneteenth National Independence Day", utcDate(2027, 5, 18)),
  toHolidayRecord("Independence Day", utcDate(2027, 6, 5)),
  toHolidayRecord("Labor Day", utcDate(2027, 8, 6)),
  toHolidayRecord("Columbus Day", utcDate(2027, 9, 11)),
  toHolidayRecord("Veterans Day", utcDate(2027, 10, 11)),
  toHolidayRecord("Thanksgiving Day", utcDate(2027, 10, 25)),
  toHolidayRecord("Christmas Day", utcDate(2027, 11, 25)),
];
