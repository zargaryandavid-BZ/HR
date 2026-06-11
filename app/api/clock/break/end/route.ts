import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

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
