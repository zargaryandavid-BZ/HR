import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

const breakSchema = z.object({
  breakType: z.enum(["REST", "MEAL"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
});

const createEntrySchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().optional(),
  reason: z.string().min(1, "Reason is required"),
  breaks: z.array(breakSchema).optional(),
});

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
    const parsed = createEntrySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Validation failed",
        parsed.error.errors[0]?.message ?? "Invalid request body",
        400
      );
    }

    const clockIn = new Date(parsed.data.clockIn);
    const clockOut = parsed.data.clockOut ? new Date(parsed.data.clockOut) : null;
    if (clockOut && clockOut < clockIn) {
      return apiError("Validation failed", "Clock out cannot be before clock in", 400);
    }

    const breaks = parsed.data.breaks ?? [];
    const breakRows = breaks.map((brk) => {
      const startedAt = new Date(brk.startedAt);
      const endedAt = brk.endedAt ? new Date(brk.endedAt) : null;
      if (startedAt < clockIn) {
        throw new Error("Break in time cannot be before clock in");
      }
      if (clockOut && startedAt > clockOut) {
        throw new Error("Break in time cannot be after clock out");
      }
      if (endedAt && endedAt < startedAt) {
        throw new Error("Break out time cannot be before break in");
      }
      if (clockOut && !endedAt) {
        throw new Error("Break out time is required when clock out is set");
      }
      if (clockOut && endedAt && endedAt > clockOut) {
        throw new Error("Break out time cannot be after clock out");
      }
      const durationMin = endedAt
        ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000))
        : null;
      return {
        breakType: brk.breakType,
        startedAt,
        endedAt,
        durationMin,
      };
    });

    const totalBreakMinutes = breakRows.reduce((sum, brk) => sum + (brk.durationMin ?? 0), 0);
    const hoursWorked = clockOut
      ? Math.max(0, (clockOut.getTime() - clockIn.getTime() - totalBreakMinutes * 60_000) / 3_600_000)
      : null;
    const status = clockOut
      ? "COMPLETED"
      : breakRows.some((b) => b.endedAt == null)
        ? "ON_BREAK"
        : "IN_PROGRESS";

    const dayStart = startOfDay(clockIn);
    const dayEnd = endOfDay(clockIn);

    // Reject if any entry for this employee already exists on the same calendar day
    const existingToday = await prisma.timeEntry.findFirst({
      where: {
        employeeId: parsed.data.employeeId,
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

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          employeeId: parsed.data.employeeId,
          clockIn,
          clockOut,
          hoursWorked,
          status,
          clockInMethod: "MANUAL",
          clockOutMethod: clockOut ? "MANUAL" : null,
          notes: parsed.data.reason,
        },
      });

      if (breakRows.length > 0) {
        await tx.breakEntry.createMany({
          data: breakRows.map((brk) => ({
            timeEntryId: created.id,
            breakType: brk.breakType,
            startedAt: brk.startedAt,
            endedAt: brk.endedAt,
            durationMin: brk.durationMin,
          })),
        });
      }

      return created;
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MANUAL_TIME_ENTRY",
        targetId: entry.id,
        targetTable: "TimeEntry",
        newValue: {
          ...entry,
          breakCount: breakRows.length,
        },
        reason: parsed.data.reason,
      },
    });
    return Response.json(apiSuccess(entry, "Entry added"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add entry";
    if (
      message.includes("Break in time") ||
      message.includes("Break out time") ||
      message.includes("Clock out")
    ) {
      return apiError("Validation failed", message, 400);
    }
    return apiError("Server error", "Failed to add entry", 500);
  }
}
