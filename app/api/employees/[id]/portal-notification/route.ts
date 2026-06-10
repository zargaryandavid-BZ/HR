import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { portalNotificationSchema } from "@/lib/validations";
import { sendPortalReviewNotification } from "@/lib/notifications/send-portal-request";

type RouteParams = { params: Promise<{ id: string }> };

/** Send a portal review notification to an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = portalNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Validation failed",
        parsed.error.errors[0]?.message ?? "Invalid data"
      );
    }

    const result = await sendPortalReviewNotification({
      employeeId,
      topicId: parsed.data.topic,
      channels: parsed.data.channels,
      customMessage: parsed.data.customMessage,
      sentByUserId: session.id,
    });

    const channelLabels = result.sentChannels
      .map((c) => (c === "in_app" ? "in-app" : c))
      .join(", ");

    return Response.json(
      apiSuccess(result, `Notification sent to ${result.employeeName} (${channelLabels})`)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification";
    if (message === "Employee not found") {
      return apiError("Not found", message, 404);
    }
    if (
      message === "Cannot send notification to an inactive employee" ||
      message === "Employee has no email address on file" ||
      message === "Employee has no phone number on file"
    ) {
      return apiError("Validation failed", message, 400);
    }
    return apiError("Server error", message, 500);
  }
}
