import type { IdDocType } from "@prisma/client";
import { ID_DOC_FIELD_CONFIG } from "@/lib/identity-documents/constants";
import { isValidSsn } from "@/lib/identity-documents/ssn";

type IdentityFormValues = {
  docType?: IdDocType;
  documentNumber?: string | null;
  country?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  file?: File | null;
};

/** Validate identity document form values before create/update */
export function validateIdentityDocumentForm(
  values: IdentityFormValues,
  mode: "create" | "update"
): string | null {
  const docType = values.docType;
  const config = docType ? ID_DOC_FIELD_CONFIG[docType] : null;

  if (mode === "create" && !docType) {
    return "Document type is required";
  }

  const hasValue =
    values.documentNumber ||
    values.country ||
    values.expiryDate ||
    values.notes ||
    values.file;

  if (mode === "create" && !hasValue) {
    return "At least one field besides type is required";
  }

  if (docType === "SSN") {
    if (mode === "create" || values.documentNumber) {
      if (!isValidSsn(values.documentNumber)) {
        return "SSN must be 9 digits (XXX-XX-XXXX)";
      }
    }

    if (mode === "create" && config?.requireAttachmentOnCreate && !values.file) {
      return "SSN requires a file attachment (e.g. Social Security card scan)";
    }
  }

  return null;
}
