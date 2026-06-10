import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Marks all notifications as read for the authenticated employee */
export async function PATCH() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    await prisma.notification.updateMany({
      where: { employeeId: session.employeeId, status: { not: "READ" } },
      data: { status: "READ" },
    });

    return Response.json(apiSuccess(null, "All notifications marked as read"));
  } catch {
    return apiError("Server error", "Failed to mark notifications read", 500);
  }
}
