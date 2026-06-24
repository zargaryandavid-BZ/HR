import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { validateClockInLocation, extractClientIp } from "@/lib/geofencing";

const schema = z.object({
  breakType: z.enum(["REST", "MEAL"]),
  coords: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "Invalid break type");

    // ── Location validation ───────────────────────────────────────────────
    const clientIp = extractClientIp(req.headers);
    const locationCheck = await validateClockInLocation(clientIp, parsed.data.coords);
    if (!locationCheck.allowed) {
      return apiError("Location restricted", locationCheck.reason ?? "Action not allowed from this location.", 403);
    }

    const entry = await prisma.timeEntry.findFirst({
      where: { employeeId: session.employeeId, clockOut: null, status: "IN_PROGRESS" },
    });
    if (!entry) return apiError("Not clocked in", "No active shift", 404);

    const [breakEntry] = await prisma.$transaction([
      prisma.breakEntry.create({
        data: { timeEntryId: entry.id, breakType: parsed.data.breakType, startedAt: new Date() },
      }),
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "ON_BREAK" } }),
    ]);

    return Response.json(apiSuccess({ id: breakEntry.id }, "Break started"));
  } catch {
    return apiError("Server error", "Failed to start break", 500);
  }
}
