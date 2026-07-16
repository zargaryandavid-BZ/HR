import { apiError, apiSuccess } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { calculatePointSummary, mapViolation } from "@/lib/points-server";

/** Return the authenticated employee's point balance and history. */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    const now = new Date();
    await prisma.pointViolation.updateMany({ where: { employeeId: session.employeeId, expiresAt: { lte: now }, isExpired: false }, data: { isExpired: true } });
    const violations = await prisma.pointViolation.findMany({ where: { employeeId: session.employeeId }, orderBy: { incidentDate: "desc" } });
    const summary = calculatePointSummary(violations, now);
    return Response.json(apiSuccess({
      totalActivePoints: summary.totalActivePoints,
      tier: summary.tier.tier,
      nextExpiry: summary.nextExpiry?.toISOString() ?? null,
      violations: violations.map(mapViolation),
    }));
  } catch {
    return apiError("Server error", "Failed to fetch employee points", 500);
  }
}
