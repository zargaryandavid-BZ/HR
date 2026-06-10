import type {
  OnboardingInstanceStatus,
  OnboardingStepProgressStatus,
  OnboardingStepType,
} from "@prisma/client";
import type { FileUploadStepConfig } from "@/lib/onboarding/types";

export type OnboardingTaskStep = {
  progressId: string;
  stepId: string;
  title: string;
  description: string | null;
  stepType: OnboardingStepType;
  isRequired: boolean;
  sortOrder: number;
  status: OnboardingStepProgressStatus;
  completedAt: string | null;
  responseData: Record<string, unknown> | null;
  uploadedFileUrl: string | null;
  config: Record<string, unknown>;
};

export type OnboardingTasksPayload = {
  instanceId: string | null;
  instanceStatus: OnboardingInstanceStatus | null;
  steps: OnboardingTaskStep[];
  pendingCount: number;
  completedCount: number;
};

/** Extract saved values from responseData (supports wizard and portal formats) */
export function extractSavedValues(
  responseData: Record<string, unknown> | null,
  keys: Array<{ id: string; label: string }>
): Record<string, string | boolean> {
  if (!responseData) return {};

  const source =
    responseData.answers && typeof responseData.answers === "object"
      ? (responseData.answers as Record<string, unknown>)
      : responseData;

  const values: Record<string, string | boolean> = {};
  for (const key of keys) {
    if (source[key.label] !== undefined && source[key.label] !== null) {
      values[key.id] = source[key.label] as string | boolean;
    } else if (source[key.id] !== undefined && source[key.id] !== null) {
      values[key.id] = source[key.id] as string | boolean;
    }
  }
  return values;
}

/** Flatten responseData for read-only display */
export function flattenResponseEntries(
  responseData: Record<string, unknown> | null
): Array<{ label: string; value: string }> {
  if (!responseData) return [];

  const source =
    responseData.answers && typeof responseData.answers === "object"
      ? (responseData.answers as Record<string, unknown>)
      : responseData;

  return Object.entries(source)
    .filter(
      ([key]) =>
        !["fileName", "fileUrl", "uploadedFileUrl", "filePath", "uploadedAt"].includes(key)
    )
    .map(([label, value]) => ({
      label,
      value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? ""),
    }));
}

/** Human-readable accepted file types label */
export function formatAcceptedTypes(types: string[]): string {
  const labels = types.map((type) => {
    if (type === "application/pdf") return "PDF";
    if (type === "image/jpeg") return "JPG";
    if (type === "image/png") return "PNG";
    if (type.startsWith(".")) return type.slice(1).toUpperCase();
    return type;
  });
  return [...new Set(labels)].join(", ");
}

/** Normalize file upload config (instruction vs instructions) */
export function getUploadInstructions(
  config: FileUploadStepConfig & { instructions?: string }
): string {
  return config.instruction ?? config.instructions ?? "";
}
