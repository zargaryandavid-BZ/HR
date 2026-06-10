import { prisma } from "@/lib/prisma";
import type { GeneratedDocumentType } from "@prisma/client";
import {
  generateOfferLetterPdf,
  generateWelcomeEmailPdf,
} from "@/lib/individual-settings/pdf-generator";
import { uploadHrDocumentPdf } from "@/lib/individual-settings/storage";

const HR_DOC_TYPES: GeneratedDocumentType[] = ["OFFER_LETTER", "WELCOME_EMAIL"];

/** Generate a single HR document PDF and persist the record */
async function createHrDocument(
  employeeId: string,
  type: GeneratedDocumentType,
  generatedBy: string
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      manager: { select: { firstName: true, lastName: true } },
    },
  });
  if (!employee) return null;

  const pdfBytes =
    type === "OFFER_LETTER"
      ? await generateOfferLetterPdf(employee)
      : await generateWelcomeEmailPdf(employee);

  const uploaded = await uploadHrDocumentPdf(employeeId, type, pdfBytes);
  if (!uploaded) return null;

  return prisma.generatedDocument.create({
    data: {
      employeeId,
      type,
      fileUrl: uploaded.url,
      generatedBy,
    },
  });
}

/** Return the latest generated document per type for an employee */
export async function getLatestHrDocuments(employeeId: string) {
  const records = await prisma.generatedDocument.findMany({
    where: { employeeId },
    orderBy: { generatedAt: "desc" },
  });

  const latestByType = new Map<string, (typeof records)[0]>();
  for (const record of records) {
    if (!latestByType.has(record.type)) {
      latestByType.set(record.type, record);
    }
  }

  return HR_DOC_TYPES.map((type) => latestByType.get(type) ?? null);
}

/** Generate missing or stale HR documents from current employee profile data */
export async function syncHrDocuments(employeeId: string, generatedBy: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, updatedAt: true },
  });
  if (!employee) return [];

  for (const type of HR_DOC_TYPES) {
    const latest = await prisma.generatedDocument.findFirst({
      where: { employeeId, type },
      orderBy: { generatedAt: "desc" },
    });

    const needsGeneration =
      !latest || employee.updatedAt.getTime() > latest.generatedAt.getTime();

    if (needsGeneration) {
      await createHrDocument(employeeId, type, generatedBy);
    }
  }

  return getLatestHrDocuments(employeeId);
}

export { HR_DOC_TYPES, createHrDocument };
