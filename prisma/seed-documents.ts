import { PrismaClient, DocumentType } from "@prisma/client";
import { syncCompanyWideAssignments } from "../lib/documents/service";

const prisma = new PrismaClient();

const PLACEHOLDER_PDF =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

/** Default company-wide documents for Bazaar Printing */
const DEFAULT_COMPANY_DOCUMENTS: Array<{
  title: string;
  documentType: DocumentType;
  description: string;
}> = [
  {
    title: "Tax Form W4",
    documentType: "TAX_FORM",
    description: "Federal income tax withholding form required for all US employees",
  },
  {
    title: "DE4 Form",
    documentType: "TAX_FORM",
    description: "California state income tax withholding form",
  },
  {
    title: "Direct Deposit Authorization",
    documentType: "TAX_FORM",
    description: "Payroll bank account setup form",
  },
  {
    title: "Non-Disclosure Agreement",
    documentType: "NDA",
    description: "Confidentiality agreement required for all Bazaar Printing employees",
  },
  {
    title: "Employee Handbook",
    documentType: "ONBOARDING_DOCUMENT",
    description: "Bazaar Printing company policies, culture, and expectations guide",
  },
  {
    title: "I-9 Form",
    documentType: "EMPLOYEE_AGREEMENT",
    description: "Federal work authorization verification required by law for all US employees",
  },
];

/** Seed default company-wide documents and migrate position links from legacy arrays */
async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["HR_ADMIN", "SUPER_ADMIN"] } },
  });

  if (!admin) {
    console.log("No HR admin found — skipping document seed.");
    return;
  }

  for (const doc of DEFAULT_COMPANY_DOCUMENTS) {
    const existing = await prisma.sop.findFirst({ where: { title: doc.title } });
    if (existing) continue;

    const created = await prisma.sop.create({
      data: {
        title: doc.title,
        description: doc.description,
        documentType: doc.documentType,
        scope: "COMPANY_WIDE",
        fileUrl: PLACEHOLDER_PDF,
        uploadedById: admin.id,
        isActive: true,
      },
    });

    await syncCompanyWideAssignments({
      sopId: created.id,
      assignedById: admin.id,
      documentTitle: created.title,
    });

    console.log(`✓ Seeded company-wide document: ${doc.title}`);
  }

  const legacyDocs = await prisma.sop.findMany({
    where: {
      OR: [{ departmentIds: { isEmpty: false } }, { positionIds: { isEmpty: false } }],
    },
  });

  for (const doc of legacyDocs) {
    await prisma.documentPositionLink.deleteMany({ where: { documentId: doc.id } });
    for (const positionId of doc.positionIds) {
      await prisma.documentPositionLink.create({
        data: { documentId: doc.id, positionId },
      });
    }
    for (const departmentId of doc.departmentIds) {
      await prisma.documentPositionLink.create({
        data: { documentId: doc.id, departmentId },
      });
    }
  }

  if (legacyDocs.length) {
    console.log(`✓ Migrated ${legacyDocs.length} documents to position links`);
  }

  console.log("Document seed completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
