import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Mark all in-app notifications as read for the current user */
export async function POST() {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    await prisma.notification.updateMany({
      where: {
        employeeId: session.employeeId,
        channel: "IN_APP",
        status: { not: "READ" },
      },
      data: { status: "READ" },
    });

    return Response.json(apiSuccess(null, "All notifications marked as read"));
  } catch {
    return apiError("Server error", "Failed to mark notifications as read", 500);
  }
}
