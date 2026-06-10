import type { IdDocType } from "@prisma/client";
import { stripSsnDigits } from "@/lib/identity-documents/ssn";

/** Mask SSN for display — no digits revealed */
export function maskSsnForDisplay(value: string | null | undefined): string | null {
  const digits = stripSsnDigits(value ?? "");
  if (digits.length === 0 && !value?.trim()) return null;
  return "***-**-****";
}

/** Mask any identity document number for display — fully hidden */
export function maskDocumentNumberForDisplay(
  value: string | null | undefined,
  docType: IdDocType
): string | null {
  if (!value?.trim()) return null;
  if (docType === "SSN") return maskSsnForDisplay(value);
  const length = Math.min(value.trim().length, 16);
  return "•".repeat(Math.max(8, length));
}
