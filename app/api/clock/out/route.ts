import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

export async function POST(_req: NextRequest) {
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
    });
    if (!entry) return apiError("Not clocked in", "No active shift found", 404);

    const openBreak = entry.breaks.find((b) => !b.endedAt);
    if (openBreak) {
      const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
      await prisma.breakEntry.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date(), durationMin },
      });
    }

    const clockOut = new Date();

    // Subtract all completed break time so re-clock gaps don't inflate hours worked
    const totalBreakMs = entry.breaks
      .filter((b) => b.endedAt)
      .reduce((sum, b) => sum + (b.durationMin ?? 0) * 60 * 1000, 0);
    const rawMs = clockOut.getTime() - entry.clockIn.getTime();
    const hoursWorked = Math.max(0, (rawMs - totalBreakMs) / 3_600_000);

    const updated = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { clockOut, hoursWorked, status: "COMPLETED", clockOutMethod: "PORTAL" },
      include: { breaks: true },
    });

    await triggerAccrualForHoursWorked(session.employeeId, hoursWorked);

    const totalBreakMin = updated.breaks
      .filter((b) => b.endedAt)
      .reduce((sum, b) => sum + (b.durationMin ?? 0), 0);

    return Response.json(
      apiSuccess({ hoursWorked, totalBreakMin, entry: updated }, "Clocked out")
    );
  } catch {
    return apiError("Server error", "Failed to clock out", 500);
  }
}
