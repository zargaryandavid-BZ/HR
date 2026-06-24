import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfDay, endOfDay } from "date-fns";
import { validateClockInLocation, extractClientIp } from "@/lib/geofencing";

export async function POST(req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    // ── Location validation ───────────────────────────────────────────────
    let coords: { lat: number; lng: number; accuracy?: number } | undefined;
    try {
      const body = await req.json();
      coords = body?.coords;
    } catch { /* body may be empty */ }
    const clientIp = extractClientIp(req.headers);
    const locationCheck = await validateClockInLocation(clientIp, coords);
    if (!locationCheck.allowed) {
      return apiError("Location restricted", locationCheck.reason ?? "Clock-in not allowed from this location.", 403);
    }

    const now = new Date();

    // 1. Already clocked in — reject
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
    });
    if (openEntry) {
      return apiError("Already clocked in", "You are already clocked in", 409);
    }

    // 2. Completed entry from today — re-open it, record gap as a REST break
    const todayEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        status: "COMPLETED",
        clockIn: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
      orderBy: { clockIn: "desc" },
    });

    if (todayEntry && todayEntry.clockOut) {
      const gapMinutes = (now.getTime() - todayEntry.clockOut.getTime()) / 60000;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.breakEntry.create({
          data: {
            timeEntryId: todayEntry.id,
            breakType: "REST",
            startedAt: todayEntry.clockOut!,
            endedAt: now,
            durationMin: gapMinutes,
          },
        });

        return tx.timeEntry.update({
          where: { id: todayEntry.id },
          data: {
            clockOut: null,
            hoursWorked: null,
            status: "IN_PROGRESS",
          },
        });
      });

      return Response.json(
        apiSuccess(
          { id: updated.id, clockIn: updated.clockIn, resumedShift: true },
          "Shift resumed — break recorded automatically"
        )
      );
    }

    // 3. No entry today — create fresh
    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: session.employeeId,
        clockIn: now,
        status: "IN_PROGRESS",
        clockInMethod: "PORTAL",
      },
    });

    return Response.json(apiSuccess({ id: entry.id, clockIn: entry.clockIn }, "Clocked in"));
  } catch {
    return apiError("Server error", "Failed to clock in", 500);
  }
}
