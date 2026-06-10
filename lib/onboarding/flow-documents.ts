import type { OnboardingStep } from "@prisma/client";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { prisma } from "@/lib/prisma";
import { createInAppNotification } from "@/lib/documents/service";
import type { DocumentSignStepConfig } from "@/lib/onboarding/types";

const activeDocFilter = { isActive: true, status: "ACTIVE" as const };

/** Collect repository document IDs linked to DOCUMENT_SIGN automation steps */
export function extractFlowDocumentIds(
  steps: Pick<OnboardingStep, "stepType" | "config">[]
): string[] {
  const ids = new Set<string>();

  for (const step of steps) {
    if (step.stepType !== "DOCUMENT_SIGN") continue;
    const config = step.config as DocumentSignStepConfig;
    if (config.documentId) ids.add(config.documentId);
  }

  return [...ids];
}

/** Assign and send automation flow documents to the employee portal */
export async function syncAutomationFlowDocuments(
  employeeId: string,
  steps: Pick<OnboardingStep, "stepType" | "config">[],
  assignedByUserId: string
): Promise<{ sent: number; documentIds: string[] }> {
  const documentIds = extractFlowDocumentIds(steps);
  if (!documentIds.length) {
    return { sent: 0, documentIds: [] };
  }

  const activeDocs = await prisma.sop.findMany({
    where: { id: { in: documentIds }, ...activeDocFilter },
    select: { id: true },
  });
  const activeIds = new Set(activeDocs.map((doc) => doc.id));
  const now = new Date();
  let sent = 0;

  for (const documentId of documentIds) {
    if (!activeIds.has(documentId)) continue;

    await prisma.documentAssignment.upsert({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(documentId, employeeId),
      },
      create: {
        sopId: documentId,
        employeeId,
        assignedById: assignedByUserId,
        assignedManually: false,
        isOffboarding: false,
        sentAt: now,
      },
      update: { sentAt: now },
    });

    sent++;
  }

  return { sent, documentIds: documentIds.filter((id) => activeIds.has(id)) };
}

/** Notify employee that automation onboarding documents are ready */
export async function notifyAutomationDocumentsSent(
  employeeId: string,
  count: number
): Promise<void> {
  if (count <= 0) return;

  await createInAppNotification({
    employeeId,
    eventType: "ONBOARDING_STARTED",
    message: `${count} onboarding document${count !== 1 ? "s have" : " has"} been assigned to you. Please log in to review and sign them.`,
    metadata: { href: "/employee/dashboard", count },
  });
}
