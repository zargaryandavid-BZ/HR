export const PORTAL_REQUEST_TOPIC_IDS = [
  "GENERAL_REVIEW",
  "DOCUMENT_SIGNATURE",
  "DOCUMENT_UPDATE",
  "ONBOARDING_TASK",
  "WRITEUP_ACKNOWLEDGMENT",
  "LEAVE_REQUEST",
  "PROFILE_UPDATE",
  "SCHEDULE_UPDATE",
  "HR_DOCUMENT",
  "IDENTITY_DOCUMENT",
] as const;

export type PortalRequestTopicId = (typeof PORTAL_REQUEST_TOPIC_IDS)[number];

export type PortalRequestTopic = {
  id: PortalRequestTopicId;
  label: string;
  detail: string;
};

export const PORTAL_REQUEST_TOPICS: PortalRequestTopic[] = [
  {
    id: "GENERAL_REVIEW",
    label: "General portal review",
    detail: "HR has requested you review your employee portal.",
  },
  {
    id: "DOCUMENT_SIGNATURE",
    label: "Document signature required",
    detail: "A document in your portal requires your signature.",
  },
  {
    id: "DOCUMENT_UPDATE",
    label: "Document update",
    detail: "A document in your portal has been updated — please review.",
  },
  {
    id: "ONBOARDING_TASK",
    label: "Onboarding task",
    detail: "You have onboarding steps to complete in your portal.",
  },
  {
    id: "WRITEUP_ACKNOWLEDGMENT",
    label: "Write-up acknowledgment",
    detail: "A write-up in your portal requires your acknowledgment.",
  },
  {
    id: "LEAVE_REQUEST",
    label: "Leave request",
    detail: "Your leave request needs your attention in the portal.",
  },
  {
    id: "PROFILE_UPDATE",
    label: "Profile information update",
    detail: "Please review and confirm your profile information.",
  },
  {
    id: "SCHEDULE_UPDATE",
    label: "Schedule update",
    detail: "Your work schedule has been updated — please review.",
  },
  {
    id: "HR_DOCUMENT",
    label: "HR document available",
    detail: "A new HR document is available in your portal.",
  },
  {
    id: "IDENTITY_DOCUMENT",
    label: "Identity document update",
    detail: "Please upload or update your identity documentation.",
  },
];

/** Resolve topic metadata by id */
export function getPortalRequestTopic(topicId: PortalRequestTopicId): PortalRequestTopic {
  const topic = PORTAL_REQUEST_TOPICS.find((t) => t.id === topicId);
  if (!topic) {
    return PORTAL_REQUEST_TOPICS[0];
  }
  return topic;
}

function getPortalLoginUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/employee/login`;
}

/** Build employee-facing messages for a portal review notification */
export function buildPortalRequestMessages({
  employeeName,
  topicId,
  customMessage,
}: {
  employeeName: string;
  topicId: PortalRequestTopicId;
  customMessage?: string;
}) {
  const topic = getPortalRequestTopic(topicId);
  const portalUrl = getPortalLoginUrl();
  const note = customMessage?.trim() ?? "";
  const baseMessage = topic.detail;

  const inAppMessage = note ? `${baseMessage}\nNote: ${note}` : baseMessage;

  const emailSubject = "Action needed — review your employee portal";
  const noteHtml = note ? `<p><strong>Note:</strong> ${escapeHtml(note)}</p>` : "";
  const emailHtml = `<p>Hi ${escapeHtml(employeeName)},</p>
<p>${escapeHtml(baseMessage)}</p>
${noteHtml}
<p><a href="${portalUrl}">Log in to your employee portal</a></p>
<p>Sign in with your registered phone number.</p>`;

  const smsNote = note ? ` Note: ${note}.` : "";
  const smsBody = `Hi ${employeeName}, ${baseMessage}${smsNote} Log in: ${portalUrl}`;

  return {
    title: topic.label,
    baseMessage,
    inAppMessage,
    emailSubject,
    emailHtml,
    smsBody,
    portalUrl,
    topicLabel: topic.label,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
