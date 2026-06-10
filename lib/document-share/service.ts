import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/instantly";
import { sendSms } from "@/lib/twilio";
import { getEmployeeDocumentsWithStatus } from "@/lib/individual-settings/documents";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { uploadSignedDocument } from "@/lib/documents/storage";
import { createInAppNotification } from "@/lib/documents/service";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";

const LINK_EXPIRY_DAYS = 7;

/** Build the public document share URL for a token */
export function buildDocumentShareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/docs/${token}`;
}

/** Load all documents assigned to an employee for the public share page */
export async function getShareableDocuments(employeeId: string) {
  const { companyWide, assigned } = await getEmployeeDocumentsWithStatus(employeeId, {
    sentOnly: true,
  });
  return [...companyWide, ...assigned];
}

/** Count how many documents have signed uploads for an employee */
export async function countUploadedDocuments(employeeId: string): Promise<{
  total: number;
  uploaded: number;
}> {
  const docs = await getShareableDocuments(employeeId);
  const uploaded = docs.filter((d) => d.signedFileUrl).length;
  return { total: docs.length, uploaded };
}

/** Resolve share link status label for HR sent-links table */
export function resolveShareLinkStatus(
  link: {
    viewedAt: Date | null;
    completedAt: Date | null;
  },
  uploaded: number,
  total: number
): string {
  if (link.completedAt) return "✅ Completed";
  if (!link.viewedAt) return "Not opened";
  if (uploaded === 0) return `Opened — 0/${total} docs uploaded`;
  if (uploaded < total) return `In progress — ${uploaded}/${total} docs uploaded`;
  return "✅ Completed";
}

/** Create a share link, send via SMS or email, and log the action */
export async function sendDocumentShareLink({
  employeeId,
  channel,
  recipient,
  createdBy,
  selectedDocumentIds = [],
}: {
  employeeId: string;
  channel: "SMS" | "EMAIL";
  recipient: string;
  createdBy: string;
  selectedDocumentIds?: string[];
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, preferredName: true },
  });
  if (!employee) return null;

  const token = randomUUID();
  const expiresAt = addDays(new Date(), LINK_EXPIRY_DAYS);
  const linkUrl = buildDocumentShareUrl(token);
  const firstName = employee.preferredName ?? employee.firstName;
  const docCount = selectedDocumentIds.length;

  const shareLink = await prisma.documentShareLink.create({
    data: {
      employeeId,
      token,
      channel,
      recipient,
      expiresAt,
      createdBy,
      selectedDocumentIds,
    },
  });

  if (channel === "SMS") {
    const docLine =
      docCount > 0
        ? `You have ${docCount} onboarding document${docCount === 1 ? "" : "s"} to complete for Pixel Press Print.`
        : "Your onboarding documents from Pixel Press Print are ready.";
    const body = `Hi ${firstName}, ${docLine} Open this secure link to review and return your documents: ${linkUrl} This link expires in 7 days.`;
    await sendSms(recipient, body);
  } else {
    const subject = "Your onboarding documents — Pixel Press Print";
    const html = `<p>Hi ${firstName},</p>
<p>Your onboarding documents are ready for review. Please open the secure link below to download each document, sign it, and upload your signed copy.</p>
<p><a href="${linkUrl}">Open Documents →</a></p>
<p>This link expires in 7 days.</p>
<p>— Pixel Press Print HR Team</p>`;
    await sendEmail(recipient, subject, html);
  }

  await logIndividualSettingsAudit({
    userId: createdBy,
    action: "DOCUMENT_LINK_SENT",
    targetId: employeeId,
    targetTable: "DocumentShareLink",
    newValue: {
      employeeId,
      channel,
      recipient,
      token,
      selectedDocumentIds,
      performedBy: createdBy,
    },
  });

  return { shareLink, linkUrl };
}

/** Resend an existing share link via its original channel */
export async function resendDocumentShareLink(linkId: string, resentBy: string) {
  const link = await prisma.documentShareLink.findUnique({
    where: { id: linkId },
    include: {
      employee: { select: { firstName: true, preferredName: true } },
    },
  });
  if (!link) return null;

  const linkUrl = buildDocumentShareUrl(link.token);
  const firstName = link.employee.preferredName ?? link.employee.firstName;

  if (link.channel === "SMS") {
    const body = `Hi ${firstName}, your onboarding documents from Pixel Press Print are ready. Open this secure link to review and return your documents: ${linkUrl} This link expires in 7 days.`;
    await sendSms(link.recipient, body);
  } else {
    const subject = "Your onboarding documents — Pixel Press Print";
    const html = `<p>Hi ${firstName},</p>
<p>Your onboarding documents are ready for review. Please open the secure link below to download each document, sign it, and upload your signed copy.</p>
<p><a href="${linkUrl}">Open Documents →</a></p>
<p>This link expires in 7 days.</p>
<p>— Pixel Press Print HR Team</p>`;
    await sendEmail(link.recipient, subject, html);
  }

  await logIndividualSettingsAudit({
    userId: resentBy,
    action: "DOCUMENT_LINK_SENT",
    targetId: link.employeeId,
    targetTable: "DocumentShareLink",
    newValue: {
      employeeId: link.employeeId,
      channel: link.channel,
      recipient: link.recipient,
      token: link.token,
      performedBy: resentBy,
      resent: true,
    },
  });

  return { linkUrl };
}

/** Validate a share token and return link + employee if usable */
export async function validateShareToken(token: string) {
  const link = await prisma.documentShareLink.findUnique({
    where: { token },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          preferredName: true,
        },
      },
    },
  });

  if (!link) return { error: "invalid" as const };
  if (link.expiresAt < new Date()) return { error: "expired" as const };

  if (!link.viewedAt) {
    await prisma.documentShareLink.update({
      where: { id: link.id },
      data: { viewedAt: new Date() },
    });
  }

  return { link };
}

/** Upload a signed document via public share token */
export async function uploadViaShareToken(
  token: string,
  documentId: string,
  file: File
) {
  const validation = await validateShareToken(token);
  if ("error" in validation) return validation;

  const { link } = validation;
  const employeeId = link.employeeId;

  const sop = await prisma.sop.findFirst({
    where: { id: documentId, isActive: true, status: "ACTIVE" },
  });
  if (!sop) return { error: "document_not_found" as const };

  const uploaded = await uploadSignedDocument(employeeId, documentId, file);
  if (!uploaded) return { error: "invalid_file" as const };

  const now = new Date();

  await prisma.documentAssignment.upsert({
    where: {
      sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
    },
    create: {
      sopId: documentId,
      employeeId,
      assignedById: link.createdBy,
      isOffboarding: false,
      signedFileUrl: uploaded.url,
      signedAt: now,
      acknowledgedAt: now,
    },
    update: {
      signedFileUrl: uploaded.url,
      signedAt: now,
      acknowledgedAt: now,
    },
  });

  await logIndividualSettingsAudit({
    userId: link.createdBy,
    action: "DOCUMENT_SIGNED_UPLOADED",
    targetId: employeeId,
    targetTable: "DocumentAssignment",
    newValue: {
      employeeId,
      documentId,
      token,
      fileName: uploaded.fileName,
    },
  });

  const { total, uploaded: uploadedCount } = await countUploadedDocuments(employeeId);

  if (uploadedCount >= total && total > 0 && !link.completedAt) {
    await prisma.documentShareLink.update({
      where: { id: link.id },
      data: { completedAt: now },
    });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true, preferredName: true },
    });
    const name = employee
      ? `${employee.preferredName ?? employee.firstName} ${employee.lastName}`
      : "Employee";

    const hrUsers = await prisma.user.findMany({
      where: {
        role: { in: ["HR_ADMIN", "SUPER_ADMIN"] },
        employeeId: { not: null },
      },
      select: { employeeId: true },
    });

    const notifyIds = new Set<string>();
    if (link.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: link.createdBy },
        select: { employeeId: true },
      });
      if (creator?.employeeId) notifyIds.add(creator.employeeId);
    }
    for (const u of hrUsers) {
      if (u.employeeId) notifyIds.add(u.employeeId);
    }

    await Promise.all(
      [...notifyIds].map((empId) =>
        createInAppNotification({
          employeeId: empId,
          eventType: "DOCUMENTS_COMPLETED",
          message: `${name} has uploaded all signed documents.`,
          metadata: { employeeId, shareLinkId: link.id },
        })
      )
    );
  }

  return {
    signedFileUrl: uploaded.url,
    fileName: uploaded.fileName,
    uploadedCount,
    total,
  };
}
