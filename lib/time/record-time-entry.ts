import type { TimeEntrySource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateHours } from "@/lib/time/hours-worked";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

type RecordTimeEntryInput = {
  employeeId: string;
  eventType: "CLOCK_IN" | "CLOCK_OUT";
  timestamp?: Date;
  source: TimeEntrySource;
  locationLat?: number;
  locationLng?: number;
  locationZoneId?: string;
};

/** Create a time entry and trigger accrual when an employee clocks out */
export async function recordTimeEntry(input: RecordTimeEntryInput) {
  const entry = await prisma.timeEntry.create({
    data: {
      employeeId: input.employeeId,
      eventType: input.eventType,
      timestamp: input.timestamp ?? new Date(),
      source: input.source,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      locationZoneId: input.locationZoneId,
    },
  });

  if (input.eventType === "CLOCK_OUT") {
    const clockIn = await prisma.timeEntry.findFirst({
      where: {
        employeeId: input.employeeId,
        eventType: "CLOCK_IN",
        timestamp: { lt: entry.timestamp },
      },
      orderBy: { timestamp: "desc" },
    });

    if (clockIn) {
      const hoursWorked = calculateHours(clockIn.timestamp, entry.timestamp);
      await triggerAccrualForHoursWorked(input.employeeId, hoursWorked);
    }
  }

  return entry;
}
