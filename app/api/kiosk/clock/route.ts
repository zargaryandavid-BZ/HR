import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";
import { startOfDay, endOfDay } from "date-fns";
import { validateClockInLocation, extractClientIp } from "@/lib/geofencing";

/**
 * Public kiosk clock endpoint — no admin auth required.
 * Physical access control is the first layer; geofencing / IP validation
 * is the second layer (configured via env vars).
 * Excluded from middleware auth via the `api/kiosk` matcher bypass.
 */

const schema = z.object({
  employeeNumber: z.string().min(1),
  action: z
    .enum(["CLOCK_OUT", "BREAK_START_REST", "BREAK_START_MEAL", "BREAK_END"])
    .optional(),
  /** GPS coordinates sent by mobile clients */
  coords: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", "Employee ID is required");
    }

    const { employeeNumber, action, coords } = parsed.data;

    // ── Geofence / network validation ─────────────────────────────────────
    // Only enforce on clock-in actions (no action = initial clock-in, or
    // on actions that modify a shift). This keeps the check lightweight.
    const clientIp = extractClientIp(req.headers);
    const locationCheck = validateClockInLocation(clientIp, coords);
    if (!locationCheck.allowed) {
      console.warn(`[kiosk/clock] Location check failed — ip=${clientIp} method=${locationCheck.method} reason="${locationCheck.reason}"`);
      return apiError("Location restricted", locationCheck.reason ?? "Clock-in not allowed from this location.", 403);
    }

    // Bug fix: check isActive so deactivated employees cannot use kiosk
    const emp = await prisma.employee.findUnique({
      where: { employeeNumber },
      select: { id: true, firstName: true, lastName: true, status: true },
    });
    if (!emp) return apiError("Not found", "Employee ID not recognised", 404);
    if (emp.status !== "ACTIVE") return apiError("Inactive", "This employee account is no longer active", 403);

    const employeeId = emp.id;
    const employee = { firstName: emp.firstName, lastName: emp.lastName };
    const now = new Date();

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId, clockOut: null, status: { in: ["IN_PROGRESS", "ON_BREAK"] } },
      include: { breaks: { orderBy: { startedAt: "desc" }, take: 1 } },
    });

    // ── CLOCK OUT ──────────────────────────────────────────────────────
    if (action === "CLOCK_OUT") {
      if (!openEntry) return apiError("Not clocked in", "No active shift", 404);

      const openBreak = openEntry.breaks[0];
      if (openBreak && !openBreak.endedAt) {
        const durationMin = (now.getTime() - openBreak.startedAt.getTime()) / 60000;
        await prisma.breakEntry.update({
          where: { id: openBreak.id },
          data: { endedAt: now, durationMin },
        });
      }

      const allBreaks = await prisma.breakEntry.findMany({ where: { timeEntryId: openEntry.id } });
      const totalBreakMs = allBreaks.reduce((s, b) => {
        if (!b.endedAt) return s;
        return s + (b.durationMin ?? 0) * 60000;
      }, 0);
      const rawMs = now.getTime() - openEntry.clockIn.getTime();
      const hoursWorked = Math.max(0, (rawMs - totalBreakMs) / 3_600_000);

      await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { clockOut: now, hoursWorked, status: "COMPLETED", clockOutMethod: "KIOSK" },
      });
      await triggerAccrualForHoursWorked(employeeId, hoursWorked);

      return Response.json(apiSuccess({ action: "CLOCKED_OUT", employee, hoursWorked }));
    }

    // ── START REST BREAK ───────────────────────────────────────────────
    if (action === "BREAK_START_REST") {
      if (!openEntry || openEntry.status !== "IN_PROGRESS")
        return apiError("Not available", "Not clocked in or already on break", 409);

      await prisma.$transaction([
        prisma.breakEntry.create({
          data: { timeEntryId: openEntry.id, breakType: "REST", startedAt: now },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "ON_BREAK" } }),
      ]);

      return Response.json(apiSuccess({ action: "BREAK_STARTED", breakType: "REST", employee }));
    }

    // ── START MEAL / LUNCH BREAK ───────────────────────────────────────
    if (action === "BREAK_START_MEAL") {
      if (!openEntry || openEntry.status !== "IN_PROGRESS")
        return apiError("Not available", "Not clocked in or already on break", 409);

      await prisma.$transaction([
        prisma.breakEntry.create({
          data: { timeEntryId: openEntry.id, breakType: "MEAL", startedAt: now },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "ON_BREAK" } }),
      ]);

      return Response.json(apiSuccess({ action: "BREAK_STARTED", breakType: "MEAL", employee }));
    }

    // ── END BREAK ──────────────────────────────────────────────────────
    if (action === "BREAK_END") {
      if (!openEntry || openEntry.status !== "ON_BREAK")
        return apiError("Not on break", "Employee is not on break", 409);

      const openBreak = openEntry.breaks[0];
      if (!openBreak || openBreak.endedAt)
        return apiError("No break", "No open break found", 404);

      const durationMin = (now.getTime() - openBreak.startedAt.getTime()) / 60000;

      await prisma.$transaction([
        prisma.breakEntry.update({
          where: { id: openBreak.id },
          data: { endedAt: now, durationMin },
        }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "IN_PROGRESS" } }),
      ]);

      return Response.json(
        apiSuccess({ action: "BREAK_ENDED", breakType: openBreak.breakType, employee })
      );
    }

    // ── NO ACTION: first scan ──────────────────────────────────────────
    if (!openEntry) {
      // Bug fix: same-day re-clock — re-open completed entry, record gap as REST break
      const todayEntry = await prisma.timeEntry.findFirst({
        where: {
          employeeId,
          status: "COMPLETED",
          clockIn: { gte: startOfDay(now), lte: endOfDay(now) },
        },
        orderBy: { clockIn: "desc" },
      });

      if (todayEntry && todayEntry.clockOut) {
        const gapMin = (now.getTime() - todayEntry.clockOut.getTime()) / 60000;

        await prisma.$transaction(async (tx) => {
          await tx.breakEntry.create({
            data: {
              timeEntryId: todayEntry.id,
              breakType: "REST",
              startedAt: todayEntry.clockOut!,
              endedAt: now,
              durationMin: gapMin,
            },
          });
          return tx.timeEntry.update({
            where: { id: todayEntry.id },
            data: { clockOut: null, hoursWorked: null, status: "IN_PROGRESS" },
          });
        });

        return Response.json(
          apiSuccess({ action: "CLOCKED_IN", employee, resumedShift: true })
        );
      }

      // Fresh clock-in
      await prisma.timeEntry.create({
        data: { employeeId, clockIn: now, status: "IN_PROGRESS", clockInMethod: "KIOSK" },
      });
      return Response.json(apiSuccess({ action: "CLOCKED_IN", employee }));
    }

    // Already clocked in → return state for choice screen
    const openBreak = openEntry.breaks[0];
    const elapsed = Math.floor((now.getTime() - openEntry.clockIn.getTime()) / 1000);
    const breakElapsed =
      openBreak && !openBreak.endedAt
        ? Math.floor((now.getTime() - openBreak.startedAt.getTime()) / 1000)
        : 0;

    return Response.json(
      apiSuccess({
        action: "NEEDS_CHOICE",
        status: openEntry.status,
        breakType: openBreak?.breakType ?? null,
        employee,
        elapsed,
        breakElapsed,
      })
    );
  } catch (err) {
    console.error("[kiosk/clock]", err);
    return apiError("Server error", "Clock action failed", 500);
  }
}
