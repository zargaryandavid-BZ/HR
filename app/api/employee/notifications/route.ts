import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Returns all notifications for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const notifications = await prisma.notification.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(
      apiSuccess(
        notifications.map((n) => {
          const snapshot = n.contentSnapshot as { message?: string } | null;
          return {
            id: n.id,
            message: snapshot?.message ?? n.eventType,
            channel: n.channel,
            status: n.status,
            isRead: n.status === "READ",
            createdAt: n.createdAt.toISOString(),
          };
        })
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch notifications", 500);
  }
}
