import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/** Mark all past-due point violations as expired. */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) return apiError("Forbidden", "Not authorized", 403);
    const result = await prisma.pointViolation.updateMany({ where: { expiresAt: { lte: new Date() }, isExpired: false }, data: { isExpired: true } });
    return Response.json(apiSuccess({ expiredCount: result.count }, "Expired points updated"));
  } catch {
    return apiError("Server error", "Failed to expire points", 500);
  }
}
