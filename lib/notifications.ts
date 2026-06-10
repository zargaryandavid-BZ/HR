import { createInAppNotification } from "@/lib/documents/service";

export type CreateEmployeeNotificationInput = {
  employeeId: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
};

/** Create an in-app notification for an employee portal user */
export async function createEmployeeNotification(
  input: CreateEmployeeNotificationInput
): Promise<void> {
  await createInAppNotification({
    employeeId: input.employeeId,
    eventType: input.type,
    message: input.message,
    metadata: {
      title: input.title,
      relatedId: input.relatedId,
      relatedType: input.relatedType,
      href: "/employee/dashboard",
    },
  });
}

export type NotificationSentPayload = {
  notificationSent: true;
  notificationMessage: string;
};

/** Build a standard API payload confirming a notification was sent */
export function notificationSentResponse(message: string): NotificationSentPayload {
  return { notificationSent: true, notificationMessage: message };
}
