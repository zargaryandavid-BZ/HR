import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const entry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
      include: { breaks: true },
      orderBy: { clockIn: "desc" },
    });

    if (!entry) {
      const lastEntry = await prisma.timeEntry.findFirst({
        where: { employeeId: session.employeeId, status: "COMPLETED" },
        orderBy: { clockIn: "desc" },
        include: { breaks: true },
      });

      return Response.json(
        apiSuccess({
          isClockedIn: false,
          isOnBreak: false,
          currentEntry: null,
          elapsed: 0,
          breakSummary: [],
          lastEntry: lastEntry
            ? {
                clockIn: lastEntry.clockIn,
                clockOut: lastEntry.clockOut,
                hoursWorked: lastEntry.hoursWorked,
                breaks: lastEntry.breaks,
              }
            : null,
        })
      );
    }

    const openBreak = entry.breaks.find((b) => !b.endedAt);
    const elapsed = Math.floor((Date.now() - entry.clockIn.getTime()) / 1000);
    const breakElapsed = openBreak
      ? Math.floor((Date.now() - openBreak.startedAt.getTime()) / 1000)
      : 0;

    const breakSummary = entry.breaks.map((b) => ({
      id: b.id,
      breakType: b.breakType,
      startedAt: b.startedAt,
      endedAt: b.endedAt,
      durationMin: b.durationMin,
      isOpen: !b.endedAt,
    }));

    return Response.json(
      apiSuccess({
        isClockedIn: true,
        isOnBreak: entry.status === "ON_BREAK",
        currentEntry: {
          id: entry.id,
          clockIn: entry.clockIn,
          status: entry.status,
        },
        elapsed,
        breakElapsed,
        breakSummary,
        lastEntry: null,
      })
    );
  } catch {
    return apiError("Server error", "Failed to get clock status", 500);
  }
}
