import { prisma } from "@/lib/prisma";

const MISSED_THRESHOLD_HOURS = 16;

/** Flag time entries where clockOut is null and clockIn > 16 hours ago */
export async function detectAndFlagMissedClockOuts(): Promise<number> {
  const threshold = new Date(Date.now() - MISSED_THRESHOLD_HOURS * 60 * 60 * 1000);

  const missed = await prisma.timeEntry.findMany({
    where: {
      clockOut: null,
      clockIn: { lt: threshold },
      status: { not: "FLAGGED" },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  for (const entry of missed) {
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { status: "FLAGGED" },
    });

    await prisma.notification.create({
      data: {
        employeeId: entry.employeeId,
        eventType: "MISSED_CLOCK_OUT",
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
        contentSnapshot: {
          title: "Missed Clock-Out",
          message: `⚠ ${entry.employee.firstName} ${entry.employee.lastName} never clocked out on ${entry.clockIn.toLocaleDateString()}.`,
        },
      },
    });
  }

  return missed.length;
}
