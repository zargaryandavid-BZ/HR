import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/instantly";
import { sendSms } from "@/lib/twilio";
import { createEmployeeNotification } from "@/lib/notifications";
import { formatEmployeeName } from "@/lib/utils";
import {
  buildPortalRequestMessages,
  type PortalRequestTopicId,
} from "@/lib/notifications/portal-request-topics";

export type SendPortalRequestInput = {
  employeeId: string;
  topicId: PortalRequestTopicId;
  channels: { email: boolean; sms: boolean };
  customMessage?: string;
  sentByUserId: string;
};

export type SendPortalRequestResult = {
  employeeName: string;
  sentChannels: ("in_app" | "email" | "sms")[];
};

/** Send portal review notification via in-app + optional email/SMS */
export async function sendPortalReviewNotification(
  input: SendPortalRequestInput
): Promise<SendPortalRequestResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      workEmail: true,
      personalEmail: true,
      phone: true,
      status: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  if (employee.status !== "ACTIVE") {
    throw new Error("Cannot send notification to an inactive employee");
  }

  const employeeName = formatEmployeeName(
    employee.firstName,
    employee.lastName,
    employee.preferredName
  );
  const emailAddress = employee.workEmail ?? employee.personalEmail ?? null;

  if (input.channels.email && !emailAddress) {
    throw new Error("Employee has no email address on file");
  }

  if (input.channels.sms && !employee.phone) {
    throw new Error("Employee has no phone number on file");
  }

  const messages = buildPortalRequestMessages({
    employeeName,
    topicId: input.topicId,
    customMessage: input.customMessage,
  });

  const sentChannels: SendPortalRequestResult["sentChannels"] = [];

  await createEmployeeNotification({
    employeeId: employee.id,
    type: "PORTAL_REVIEW_REQUESTED",
    title: messages.title,
    message: messages.inAppMessage,
    relatedType: "portal_request",
  });
  sentChannels.push("in_app");

  if (input.channels.email && emailAddress) {
    const emailSent = await sendEmail(
      emailAddress,
      messages.emailSubject,
      messages.emailHtml
    );
    if (!emailSent) {
      throw new Error("Failed to send email notification");
    }
    sentChannels.push("email");
  }

  if (input.channels.sms && employee.phone) {
    const smsSent = await sendSms(employee.phone, messages.smsBody);
    if (!smsSent) {
      throw new Error("Failed to send SMS notification");
    }
    sentChannels.push("sms");
  }

  await prisma.auditLog.create({
    data: {
      userId: input.sentByUserId,
      action: "PORTAL_NOTIFICATION_SENT",
      targetId: employee.id,
      targetTable: "Employee",
      newValue: {
        topicId: input.topicId,
        channels: input.channels,
        customMessage: input.customMessage?.trim() || null,
        sentChannels,
      },
    },
  });

  return { employeeName, sentChannels };
}
