import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatEmployeeName } from "@/lib/utils";

export type ImportantDateType = "BIRTHDAY" | "ANNIVERSARY" | "HOLIDAY" | "EVENT";

export type AdminImportantDateItem = {
  type: ImportantDateType;
  date: string;
  daysUntil: number;
  label: string;
  employeeId?: string;
  employeeName?: string;
  avatarInitials?: string;
  position?: string;
  years?: number;
  /** Month/day only — never includes birth year */
  birthdayMonthDay?: { month: number; day: number };
};

const MAX_LOOKAHEAD_DAYS = 90;
const DEFAULT_LOOKAHEAD_DAYS = 30;

/** Normalize a look-ahead window (default 30, max 90) */
export function clampImportantDatesDays(days: number | undefined): number {
  if (!days || Number.isNaN(days)) return DEFAULT_LOOKAHEAD_DAYS;
  return Math.min(Math.max(Math.floor(days), 1), MAX_LOOKAHEAD_DAYS);
}

/** Start of today in local time */
function startOfToday(): Date {
  return startOfDay(new Date());
}

/** Next calendar occurrence of a month/day on or after `from` */
export function getNextOccurrence(
  month: number,
  day: number,
  from: Date = startOfToday()
): Date {
  const base = startOfDay(from);
  const year = base.getFullYear();
  let candidate = new Date(year, month - 1, day);
  if (candidate < base) {
    candidate = new Date(year + 1, month - 1, day);
  }
  return startOfDay(candidate);
}

/** Whole calendar days from `from` until `target` */
function daysUntil(target: Date, from: Date = startOfToday()): number {
  return differenceInCalendarDays(startOfDay(target), startOfDay(from));
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Extract calendar month/day from a stored date (UTC-safe for date-only values) */
function getStoredMonthDay(value: Date): { month: number; day: number } {
  return {
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function employeeInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function employeePosition(
  jobTitle: string | null | undefined,
  positionName: string | null | undefined
): string | undefined {
  return positionName ?? jobTitle ?? undefined;
}

/** Build upcoming birthdays, anniversaries, and holidays for the admin dashboard */
export async function getAdminImportantDates(
  daysParam?: number
): Promise<AdminImportantDateItem[]> {
  const days = clampImportantDatesDays(daysParam);
  const today = startOfToday();

  const items: AdminImportantDateItem[] = [];

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      birthdate: true,
      startDate: true,
      jobTitle: true,
      position: { select: { name: true } },
    },
  });

  for (const employee of employees) {
    const displayName = formatEmployeeName(
      employee.firstName,
      employee.lastName,
      employee.preferredName
    );
    const position = employeePosition(employee.jobTitle, employee.position?.name);
    const initials = employeeInitials(employee.firstName, employee.lastName);

    if (employee.birthdate) {
      const birth = new Date(employee.birthdate);
      const { month, day } = getStoredMonthDay(birth);
      const occurrence = getNextOccurrence(month, day, today);
      const until = daysUntil(occurrence, today);

      if (until >= 0 && until <= days) {
        items.push({
          type: "BIRTHDAY",
          date: toIsoDate(occurrence),
          daysUntil: until,
          label: `${displayName}'s Birthday`,
          employeeId: employee.id,
          employeeName: displayName,
          avatarInitials: initials,
          position,
          birthdayMonthDay: { month, day },
        });
      }
    }

    if (employee.startDate) {
      const start = new Date(employee.startDate);
      const { month, day } = getStoredMonthDay(start);
      const occurrence = getNextOccurrence(month, day, today);
      const until = daysUntil(occurrence, today);
      const startYear = start.getUTCFullYear();
      const years = occurrence.getFullYear() - startYear;

      if (until >= 0 && until <= days && years >= 1) {
        items.push({
          type: "ANNIVERSARY",
          date: toIsoDate(occurrence),
          daysUntil: until,
          label: `${displayName}'s ${years}-Year Anniversary`,
          employeeId: employee.id,
          employeeName: displayName,
          avatarInitials: initials,
          position,
          years,
        });
      }
    }
  }

  const holidays = await prisma.holiday.findMany({
    where: { isCompanyWide: true },
    orderBy: { date: "asc" },
  });

  for (const holiday of holidays) {
    const stored = new Date(holiday.date);

    if (holiday.isRecurringAnnually) {
      const { month, day } = getStoredMonthDay(stored);
      const occurrence = getNextOccurrence(month, day, today);
      const until = daysUntil(occurrence, today);

      if (until >= 0 && until <= days) {
        items.push({
          type: "HOLIDAY",
          date: toIsoDate(occurrence),
          daysUntil: until,
          label: holiday.name,
        });
      }
      continue;
    }

    const occurrence = startOfDay(
      new Date(stored.getUTCFullYear(), stored.getUTCMonth(), stored.getUTCDate())
    );
    const until = daysUntil(occurrence, today);

    if (until >= 0 && until <= days) {
      items.push({
        type: "HOLIDAY",
        date: toIsoDate(occurrence),
        daysUntil: until,
        label: holiday.name,
      });
    }
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
}

/** Count important dates occurring today or tomorrow (for dashboard subtitle) */
export async function countImportantDatesTodayOrTomorrow(): Promise<number> {
  const items = await getAdminImportantDates(2);
  return items.filter((item) => item.daysUntil <= 1).length;
}
