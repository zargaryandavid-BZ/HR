import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
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
      return apiError("Location restricted", locationCheck.reason ?? "Action not allowed from this location.", 403);
    }

    const entry = await prisma.timeEntry.findFirst({
      where: { employeeId: session.employeeId, clockOut: null, status: "ON_BREAK" },
      include: { breaks: { where: { endedAt: null } } },
    });
    if (!entry || entry.breaks.length === 0)
      return apiError("Not on break", "No active break found", 404);

    const openBreak = entry.breaks[0];
    const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;

    await prisma.$transaction([
      prisma.breakEntry.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date(), durationMin },
      }),
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "IN_PROGRESS" } }),
    ]);

    return Response.json(apiSuccess({ durationMin }, "Break ended"));
  } catch {
    return apiError("Server error", "Failed to end break", 500);
  }
}
