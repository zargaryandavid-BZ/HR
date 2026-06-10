import type { EmployeeIdentityDocument, IdDocType } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { maskDocumentNumberForDisplay } from "@/lib/identity-documents/mask";
import { normalizeSsnForStorage } from "@/lib/identity-documents/ssn";
import { getExpiryStatus } from "@/lib/identity-documents/expiry";

export type IdentityDocumentDto = {
  id: string;
  docType: EmployeeIdentityDocument["docType"];
  documentNumber: string | null;
  country: string | null;
  expiryDate: string | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  createdBy: string;
  createdAt: string;
};

/** Decrypt stored document number for HR Admin display */
export function decryptDocumentNumber(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  try {
    return decrypt(stored);
  } catch {
    return null;
  }
}

/** Encrypt document number before persisting */
export function encryptDocumentNumber(
  value: string | null | undefined,
  docType?: EmployeeIdentityDocument["docType"]
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized =
    docType === "SSN" ? normalizeSsnForStorage(trimmed) : trimmed;
  return encrypt(normalized);
}

/** Map a DB record to an API response — SSN numbers are masked */
export function serializeIdentityDocument(
  doc: EmployeeIdentityDocument
): IdentityDocumentDto {
  const decrypted = decryptDocumentNumber(doc.documentNumber);
  const documentNumber = maskDocumentNumberForDisplay(decrypted, doc.docType);

  return {
    id: doc.id,
    docType: doc.docType,
    documentNumber,
    country: doc.country,
    expiryDate: doc.expiryDate?.toISOString() ?? null,
    notes: doc.notes,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Return employee IDs that have an expired or soon-expiring identity document */
export async function getEmployeeIdsWithExpiringDocuments(
  employeeIds: string[],
  withinDays: number
): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();

  const today = startOfDay(new Date());
  const threshold = addDays(today, withinDays);

  const docs = await prisma.employeeIdentityDocument.findMany({
    where: {
      employeeId: { in: employeeIds },
      expiryDate: { not: null, lte: threshold },
    },
    select: { employeeId: true },
  });

  return new Set(docs.map((d) => d.employeeId));
}

export type ExpiringIdentityDocumentRow = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  docType: IdDocType;
  expiryDate: Date;
  expiryStatus: "expired" | "expiring_soon";
};

/** Identity documents expiring within N days — for admin dashboard */
export async function getExpiringIdentityDocuments(
  withinDays = 30,
  limit = 10
): Promise<ExpiringIdentityDocumentRow[]> {
  const today = startOfDay(new Date());
  const threshold = addDays(today, withinDays);

  const docs = await prisma.employeeIdentityDocument.findMany({
    where: {
      expiryDate: { not: null, lte: threshold },
      employee: { status: "ACTIVE" },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
    },
    orderBy: { expiryDate: "asc" },
    take: limit,
  });

  return docs.flatMap((doc) => {
    if (!doc.expiryDate) return [];
    const expiryStatus = getExpiryStatus(doc.expiryDate, withinDays);
    if (expiryStatus !== "expired" && expiryStatus !== "expiring_soon") {
      return [];
    }

    return [
      {
        id: doc.id,
        employeeId: doc.employee.id,
        firstName: doc.employee.firstName,
        lastName: doc.employee.lastName,
        preferredName: doc.employee.preferredName,
        docType: doc.docType,
        expiryDate: doc.expiryDate,
        expiryStatus,
      },
    ];
  });
}

/** Count identity documents expiring within N days (active employees only) */
export async function countExpiringIdentityDocuments(
  withinDays = 30
): Promise<number> {
  const today = startOfDay(new Date());
  const threshold = addDays(today, withinDays);

  return prisma.employeeIdentityDocument.count({
    where: {
      expiryDate: { not: null, lte: threshold },
      employee: { status: "ACTIVE" },
    },
  });
}
