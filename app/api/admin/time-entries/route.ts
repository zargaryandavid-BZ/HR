import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "today";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    let start: Date, end: Date;

    if (range === "week") {
      start = startOfWeek(now);
      end = endOfWeek(now);
    } else if (range === "month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (range === "custom" && from && to) {
      start = new Date(from);
      end = new Date(to);
    } else {
      start = startOfDay(now);
      end = endOfDay(now);
    }

    const entries = await prisma.timeEntry.findMany({
      where: { clockIn: { gte: start, lte: end } },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
        breaks: true,
      },
      orderBy: { clockIn: "desc" },
      take: 200,
    });

    return Response.json(apiSuccess(entries));
  } catch {
    return apiError("Server error", "Failed to fetch time entries", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const body = await req.json();

    const clockIn = new Date(body.clockIn);
    const clockOut = body.clockOut ? new Date(body.clockOut) : null;
    const dayStart = startOfDay(clockIn);
    const dayEnd = endOfDay(clockIn);

    // Reject if any entry for this employee already exists on the same calendar day
    const existingToday = await prisma.timeEntry.findFirst({
      where: {
        employeeId: body.employeeId,
        clockIn: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existingToday) {
      return apiError(
        "Duplicate entry",
        "A time entry already exists for this employee on that day. Edit the existing entry instead.",
        409
      );
    }

    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: body.employeeId,
        clockIn,
        clockOut,
        hoursWorked: clockOut
          ? Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000)
          : null,
        status: clockOut ? "COMPLETED" : "IN_PROGRESS",
        clockInMethod: "MANUAL",
        clockOutMethod: clockOut ? "MANUAL" : null,
        notes: body.reason,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MANUAL_TIME_ENTRY",
        targetId: entry.id,
        targetTable: "TimeEntry",
        newValue: entry as object,
        reason: body.reason,
      },
    });
    return Response.json(apiSuccess(entry, "Entry added"));
  } catch {
    return apiError("Server error", "Failed to add entry", 500);
  }
}
