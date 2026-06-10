import type { IdDocType } from "@prisma/client";

export const ID_DOC_TYPE_LABELS: Record<IdDocType, string> = {
  SSN: "SSN",
  PASSPORT: "Passport",
  WORK_PERMIT: "Work permit",
  DRIVERS_LICENSE: "Driver's license",
  GOVERNMENT_ID: "Government ID",
};

export const ID_DOC_TYPE_BADGE_STYLES: Record<IdDocType, { bg: string; text: string }> = {
  SSN: { bg: "#EEEDFE", text: "#534AB7" },
  PASSPORT: { bg: "#E6F1FB", text: "#185FA5" },
  WORK_PERMIT: { bg: "#EAF3DE", text: "#3B6D11" },
  DRIVERS_LICENSE: { bg: "#FAEEDA", text: "#854F0B" },
  GOVERNMENT_ID: { bg: "#E1F5EE", text: "#0F6E56" },
};

export type IdDocFieldConfig = {
  numberLabel: string;
  numberPlaceholder: string;
  countryLabel: string | null;
  countryPlaceholder: string;
  showCountry: boolean;
  showExpiry: boolean;
  /** Restrict document number input to digits (with optional formatting) */
  numbersOnly?: boolean;
  /** Mask input while typing (e.g. password field for SSN) */
  maskInput?: boolean;
  /** Require a file attachment when creating this document type */
  requireAttachmentOnCreate?: boolean;
};

export const ID_DOC_FIELD_CONFIG: Record<IdDocType, IdDocFieldConfig> = {
  SSN: {
    numberLabel: "Social Security Number",
    numberPlaceholder: "XXX-XX-XXXX",
    countryLabel: null,
    countryPlaceholder: "",
    showCountry: false,
    showExpiry: false,
    numbersOnly: true,
    maskInput: true,
    requireAttachmentOnCreate: true,
  },
  PASSPORT: {
    numberLabel: "Passport number",
    numberPlaceholder: "e.g. A12345678",
    countryLabel: "Issuing country",
    countryPlaceholder: "e.g. USA",
    showCountry: true,
    showExpiry: true,
    maskInput: true,
  },
  WORK_PERMIT: {
    numberLabel: "Permit / visa number",
    numberPlaceholder: "Permit or visa number",
    countryLabel: "Permit type (EAD, H-1B, O-1…)",
    countryPlaceholder: "e.g. H-1B",
    showCountry: true,
    showExpiry: true,
    maskInput: true,
  },
  DRIVERS_LICENSE: {
    numberLabel: "License number",
    numberPlaceholder: "License number",
    countryLabel: "State",
    countryPlaceholder: "e.g. CA",
    showCountry: true,
    showExpiry: true,
    maskInput: true,
  },
  GOVERNMENT_ID: {
    numberLabel: "ID number",
    numberPlaceholder: "Government ID number",
    countryLabel: "Issuing country / state",
    countryPlaceholder: "e.g. USA or CA",
    showCountry: true,
    showExpiry: true,
    maskInput: true,
  },
};

export const ID_DOC_TYPES = Object.keys(ID_DOC_TYPE_LABELS) as IdDocType[];
