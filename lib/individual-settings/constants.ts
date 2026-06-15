import type { WriteUpCategory } from "@prisma/client";

export type DocumentCompletionStatus =
  | "not_started"
  | "downloaded"
  | "acknowledged"
  | "signature_required"
  | "signed"
  | "hr_approved";

/** Document is fully complete only after HR approval */
export function isDocumentHrConfirmed(status: DocumentCompletionStatus): boolean {
  return status === "hr_approved";
}

/** Employee has uploaded a signed copy (may still await HR approval) */
export function isDocumentSigned(status: DocumentCompletionStatus): boolean {
  return status === "signed" || status === "hr_approved";
}

/** Whether the employee still needs to download and upload a signed copy */
export function employeeNeedsSignedUpload(status: DocumentCompletionStatus): boolean {
  return (
    status === "not_started" ||
    status === "downloaded" ||
    status === "acknowledged" ||
    status === "signature_required"
  );
}

/** Unsigned document URL — uses HR-replaced file when awaiting employee signature */
export function getDocumentDownloadUrl(doc: {
  fileUrl: string;
  signedFileUrl: string | null;
  status: DocumentCompletionStatus;
}): string {
  if (doc.status === "signature_required" && doc.signedFileUrl) {
    return doc.signedFileUrl;
  }
  return doc.fileUrl;
}

export type EmployeeDocumentStatusItem = {
  id: string;
  title: string;
  documentType: string;
  version: number;
  fileUrl: string;
  scope: "COMPANY_WIDE" | "POSITION_SPECIFIC";
  status: DocumentCompletionStatus;
  assignmentId: string | null;
  signedFileUrl: string | null;
  signedAt: string | null;
  acknowledgedAt: string | null;
  hrApprovedAt: string | null;
  hrApprovedBy: string | null;
  assignmentSentAt: string | null;
  assignedManually: boolean;
  assignmentTags: Array<{ id: string; label: string; kind: "position" | "department" }>;
};

export const WRITEUP_CATEGORY_LABELS: Record<WriteUpCategory, string> = {
  ATTENDANCE: "Attendance",
  CONDUCT: "Conduct",
  PERFORMANCE: "Performance",
  SAFETY: "Safety",
  POLICY: "Policy",
  OTHER: "Other",
};

export const WRITEUP_CATEGORY_BADGE_CLASSES: Record<WriteUpCategory, string> = {
  ATTENDANCE: "bg-amber-100 text-amber-800 border-amber-200",
  CONDUCT: "bg-red-100 text-red-800 border-red-200",
  PERFORMANCE: "bg-orange-100 text-orange-800 border-orange-200",
  SAFETY: "bg-teal-100 text-teal-800 border-teal-200",
  POLICY: "bg-gray-100 text-gray-800 border-gray-200",
  OTHER: "bg-purple-100 text-purple-800 border-purple-200",
};

export type WriteUpItem = {
  id: string;
  number: number;
  category: WriteUpCategory;
  date: string;
  description: string;
  consequence: string | null;
  issuedBy: string;
  issuedByName: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  attachmentUrl: string | null;
  createdAt: string;
};

export type ManagerNoteItem = {
  id: string;
  content: string;
  issuedBy: string;
  issuedByName: string;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedDocumentItem = {
  id: string;
  type: "OFFER_LETTER" | "WELCOME_EMAIL";
  fileUrl: string;
  generatedBy: string;
  generatedAt: string;
};
