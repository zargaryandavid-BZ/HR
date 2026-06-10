import type { DocumentRepositoryScope, DocumentType } from "@prisma/client";

/** Human-readable labels for document types */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SOP: "SOP (Standard Operating Procedure)",
  POLICY: "Policy",
  NDA: "NDA (Non-Disclosure Agreement)",
  TAX_FORM: "Tax Form",
  SAFETY_DOCUMENT: "Safety Document",
  TRAINING_MATERIAL: "Training Material",
  EMPLOYEE_AGREEMENT: "Employee Agreement",
  ONBOARDING_DOCUMENT: "Onboarding Document",
  OTHER: "Other",
};

/** Short labels for badges */
export const DOCUMENT_TYPE_SHORT_LABELS: Record<DocumentType, string> = {
  SOP: "SOP",
  POLICY: "Policy",
  NDA: "NDA",
  TAX_FORM: "Tax Form",
  SAFETY_DOCUMENT: "Safety",
  TRAINING_MATERIAL: "Training",
  EMPLOYEE_AGREEMENT: "Agreement",
  ONBOARDING_DOCUMENT: "Onboarding",
  OTHER: "Other",
};

/** Tailwind badge classes per document type */
export const DOCUMENT_TYPE_BADGE_CLASSES: Record<DocumentType, string> = {
  SOP: "bg-orange-100 text-orange-800 border-orange-200",
  POLICY: "bg-gray-100 text-gray-800 border-gray-200",
  NDA: "bg-pink-100 text-pink-800 border-pink-200",
  TAX_FORM: "bg-blue-100 text-blue-800 border-blue-200",
  SAFETY_DOCUMENT: "bg-teal-100 text-teal-800 border-teal-200",
  TRAINING_MATERIAL: "bg-cyan-100 text-cyan-800 border-cyan-200",
  EMPLOYEE_AGREEMENT: "bg-amber-100 text-amber-800 border-amber-200",
  ONBOARDING_DOCUMENT: "bg-green-100 text-green-800 border-green-200",
  OTHER: "bg-gray-100 text-gray-800 border-gray-200",
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

export type DocumentScope = DocumentRepositoryScope;

export const DOCUMENT_SCOPE_LABELS: Record<DocumentScope, string> = {
  COMPANY_WIDE: "Company-wide — included in all onboarding flows automatically",
  POSITION_SPECIFIC: "Position-specific — manually assigned to positions, departments, or employees",
};

export type AssignmentTag = {
  id: string;
  label: string;
  kind: "position" | "department";
};

export type DocumentListItem = {
  id: string;
  title: string;
  description: string;
  documentType: DocumentType;
  version: number;
  fileUrl: string;
  isActive: boolean;
  status: string;
  updatedAt: string;
  createdAt: string;
  assignedCount: number;
  fileName?: string | null;
  scope: DocumentScope;
  departmentIds: string[];
  positionIds: string[];
  assignmentTags: AssignmentTag[];
};

export type EmployeeDocumentItem = {
  id: string;
  title: string;
  description: string;
  documentType: DocumentType;
  version: number;
  fileUrl: string;
  assignedAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedVersion: number | null;
  signedFileUrl: string | null;
  signedAt: string | null;
  signedFileName: string | null;
};
