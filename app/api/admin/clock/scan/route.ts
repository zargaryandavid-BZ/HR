import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateHours } from "@/lib/time/hours-worked";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

const schema = z
  .object({
    employeeId: z.string().optional(),
    employeeNumber: z.string().optional(),
    qrToken: z.string().optional(),
    action: z
      .enum(["CLOCK_OUT", "BREAK_START_REST", "BREAK_START_MEAL", "BREAK_END"])
      .optional(),
  })
  .refine((d) => d.employeeId || d.employeeNumber || d.qrToken, {
    message: "employeeId, employeeNumber, or qrToken required",
  });

export async function POST(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "employeeId or qrToken required");

    // Resolve employee — accept employeeNumber, qrToken, or direct id
    let employeeId = parsed.data.employeeId;

    if (!employeeId && parsed.data.employeeNumber) {
      const emp = await prisma.employee.findUnique({
        where: { employeeNumber: parsed.data.employeeNumber },
        select: { id: true },
      });
      if (!emp) return apiError("Not found", "Employee number not found", 404);
      employeeId = emp.id;
    }

    if (!employeeId && parsed.data.qrToken) {
      const emp = await prisma.employee.findUnique({
        where: { qrCodeToken: parsed.data.qrToken },
        select: { id: true },
      });
      if (!emp) return apiError("Not found", "Unknown QR code", 404);
      employeeId = emp.id;
    }

    if (!employeeId) return apiError("Not found", "Employee not found", 404);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true },
    });

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId, clockOut: null, status: { in: ["IN_PROGRESS", "ON_BREAK"] } },
      include: { breaks: { orderBy: { startedAt: "desc" }, take: 1 } },
    });

    const { action } = parsed.data;

    // ── CLOCK OUT ────────────────────────────────────────────────────
    if (action === "CLOCK_OUT") {
      if (!openEntry) return apiError("Not clocked in", "No active shift", 404);

      // Close any open break first
      const openBreak = openEntry.breaks[0];
      if (openBreak && !openBreak.endedAt) {
        const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
        await prisma.breakEntry.update({
          where: { id: openBreak.id },
          data: { endedAt: new Date(), durationMin },
        });
      }

      const clockOut = new Date();
      const allBreaks = await prisma.breakEntry.findMany({
        where: { timeEntryId: openEntry.id },
      });
      const totalBreakMs = allBreaks.reduce((s, b) => {
        if (!b.endedAt) return s;
        return s + (b.durationMin ?? 0) * 60000;
      }, 0);
      const rawMs = clockOut.getTime() - openEntry.clockIn.getTime();
      const hoursWorked = Math.max(0, (rawMs - totalBreakMs) / 3_600_000);

      await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { clockOut, hoursWorked, status: "COMPLETED", clockOutMethod: "QR_SCAN" },
      });
      await triggerAccrualForHoursWorked(employeeId, hoursWorked);

      return Response.json(
        apiSuccess({ action: "CLOCKED_OUT", employee, hoursWorked }, "Clocked out via QR")
      );
    }

    // ── START REST BREAK ─────────────────────────────────────────────
    if (action === "BREAK_START_REST") {
      if (!openEntry || openEntry.status !== "IN_PROGRESS")
        return apiError("Not available", "Not clocked in or already on break", 409);

      await prisma.$transaction([
        prisma.breakEntry.create({
          data: { timeEntryId: openEntry.id, breakType: "REST", startedAt: new Date() },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "ON_BREAK" } }),
      ]);

      return Response.json(
        apiSuccess({ action: "BREAK_STARTED", breakType: "REST", employee }, "Rest break started")
      );
    }

    // ── START MEAL / LUNCH BREAK ─────────────────────────────────────
    if (action === "BREAK_START_MEAL") {
      if (!openEntry || openEntry.status !== "IN_PROGRESS")
        return apiError("Not available", "Not clocked in or already on break", 409);

      await prisma.$transaction([
        prisma.breakEntry.create({
          data: { timeEntryId: openEntry.id, breakType: "MEAL", startedAt: new Date() },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "ON_BREAK" } }),
      ]);

      return Response.json(
        apiSuccess({ action: "BREAK_STARTED", breakType: "MEAL", employee }, "Lunch break started")
      );
    }

    // ── END BREAK (REST or MEAL) ─────────────────────────────────────
    if (action === "BREAK_END") {
      if (!openEntry || openEntry.status !== "ON_BREAK")
        return apiError("Not on break", "Employee is not on break", 409);

      const openBreak = openEntry.breaks[0];
      if (!openBreak || openBreak.endedAt)
        return apiError("No break", "No open break found", 404);

      const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;

      await prisma.$transaction([
        prisma.breakEntry.update({
          where: { id: openBreak.id },
          data: { endedAt: new Date(), durationMin },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "IN_PROGRESS" } }),
      ]);

      return Response.json(
        apiSuccess(
          { action: "BREAK_ENDED", breakType: openBreak.breakType, employee },
          `${openBreak.breakType === "MEAL" ? "Lunch" : "Rest"} break ended`
        )
      );
    }

    // ── NO ACTION: first scan — auto-detect ──────────────────────────
    if (!openEntry) {
      // Not clocked in → auto clock IN
      const entry = await prisma.timeEntry.create({
        data: {
          employeeId,
          clockIn: new Date(),
          status: "IN_PROGRESS",
          clockInMethod: "QR_SCAN",
        },
      });
      return Response.json(
        apiSuccess({ action: "CLOCKED_IN", employee, entry }, "Clocked in via QR")
      );
    }

    // Already clocked in → return state for choice screen
    const openBreak = openEntry.breaks[0];
    const elapsed = Math.floor((Date.now() - openEntry.clockIn.getTime()) / 1000);
    const breakElapsed =
      openBreak && !openBreak.endedAt
        ? Math.floor((Date.now() - openBreak.startedAt.getTime()) / 1000)
        : 0;

    return Response.json(
      apiSuccess({
        action: "NEEDS_CHOICE",
        status: openEntry.status, // "IN_PROGRESS" | "ON_BREAK"
        breakType: openBreak?.breakType ?? null, // "REST" | "MEAL" | null
        employee,
        elapsed,
        breakElapsed,
        entryId: openEntry.id,
        qrToken: parsed.data.qrToken,
        employeeId,
      })
    );
  } catch {
    return apiError("Server error", "QR scan failed", 500);
  }
}
