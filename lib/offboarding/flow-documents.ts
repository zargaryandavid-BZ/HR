import type { OffboardingStep } from "@prisma/client";
import type { DocumentSignStepConfig } from "@/lib/onboarding/types";

/** Collect repository document IDs linked to DOCUMENT_SIGN offboarding steps */
export function extractOffboardingFlowDocumentIds(
  steps: Pick<OffboardingStep, "stepType" | "config">[]
): string[] {
  const ids = new Set<string>();

  for (const step of steps) {
    if (step.stepType !== "DOCUMENT_SIGN") continue;
    const config = step.config as DocumentSignStepConfig;
    if (config.documentId) ids.add(config.documentId);
  }

  return [...ids];
}
