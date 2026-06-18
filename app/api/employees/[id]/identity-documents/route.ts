import { NextRequest } from "next/server";
import { IdDocType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import {
  encryptDocumentNumber,
  serializeIdentityDocument,
} from "@/lib/identity-documents/service";
import { uploadIdentityDocumentFile } from "@/lib/identity-documents/storage";
import { validateIdentityDocumentForm } from "@/lib/identity-documents/validation";
import { isEncryptionConfigured } from "@/lib/utils/encryption";

type RouteParams = { params: Promise<{ id: string }> };

const ID_DOC_TYPES = new Set<string>([
  "SSN",
  "PASSPORT",
  "WORK_PERMIT",
  "DRIVERS_LICENSE",
  "GOVERNMENT_ID",
]);

type ParsedIdentityForm = {
  docType?: IdDocType;
  documentNumber?: string | null;
  country?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  file?: File | null;
};

/** Parse multipart identity document form fields */
async function parseIdentityForm(request: NextRequest): Promise<ParsedIdentityForm> {
  const formData = await request.formData();
  const docTypeRaw = formData.get("docType");
  const docType =
    typeof docTypeRaw === "string" && ID_DOC_TYPES.has(docTypeRaw)
      ? (docTypeRaw as IdDocType)
      : undefined;

  const documentNumberRaw = formData.get("documentNumber");
  const countryRaw = formData.get("country");
  const expiryDateRaw = formData.get("expiryDate");
  const notesRaw = formData.get("notes");
  const file = formData.get("file");

  return {
    docType,
    documentNumber:
      documentNumberRaw != null ? String(documentNumberRaw).trim() || null : undefined,
    country: countryRaw != null ? String(countryRaw).trim() || null : undefined,
    expiryDate: expiryDateRaw != null ? String(expiryDateRaw).trim() || null : undefined,
    notes: notesRaw != null ? String(notesRaw).trim() || null : undefined,
    file: file instanceof File && file.size > 0 ? file : null,
  };
}

/** Require HR Admin session for identity document routes */
async function requireIdentityDocAdmin() {
  const session = await getSession();
  if (!session) return { error: apiError("Unauthorized", "Not authenticated", 401) };
  if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return { error: apiError("Forbidden", "Not authorized", 403) };
  }
  return { session };
}

/** List identity documents for an employee (HR Admin only) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireIdentityDocAdmin();
    if ("error" in auth) return auth.error;

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const docs = await prisma.employeeIdentityDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess(docs.map(serializeIdentityDocument)));
  } catch (error) {
    console.error("List identity documents error:", error);
    return apiError("Server error", "Failed to fetch identity documents", 500);
  }
}

/** Create a new identity document for an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireIdentityDocAdmin();
    if ("error" in auth) return auth.error;
    const { session } = auth;

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const parsed = await parseIdentityForm(request);
    const validationError = validateIdentityDocumentForm(
      {
        docType: parsed.docType,
        documentNumber: parsed.documentNumber,
        country: parsed.country,
        expiryDate: parsed.expiryDate,
        notes: parsed.notes,
        file: parsed.file,
      },
      "create"
    );
    if (validationError) {
      return apiError("Validation failed", validationError);
    }

    if (!parsed.docType) {
      return apiError("Validation failed", "Document type is required");
    }

    if (parsed.documentNumber?.trim() && !isEncryptionConfigured()) {
      return apiError(
        "Server configuration error",
        "Document numbers cannot be saved until ENCRYPTION_KEY is configured on the server",
        503
      );
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (parsed.file) {
      const uploaded = await uploadIdentityDocumentFile(employeeId, parsed.file);
      if (!uploaded) {
        return apiError(
          "Validation failed",
          "File must be PDF, JPG, PNG, or HEIC under 20MB"
        );
      }
      fileUrl = uploaded.url;
      fileName = uploaded.fileName;
    }

    const doc = await prisma.employeeIdentityDocument.create({
      data: {
        employeeId,
        docType: parsed.docType,
        documentNumber: encryptDocumentNumber(parsed.documentNumber, parsed.docType),
        country: parsed.country ?? null,
        expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null,
        notes: parsed.notes ?? null,
        fileUrl,
        fileName,
        createdBy: session.id,
      },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "IDENTITY_DOCUMENT_ADDED",
      targetId: doc.id,
      targetTable: "EmployeeIdentityDocument",
      newValue: { employeeId, docType: parsed.docType, createdBy: session.id },
    });

    return Response.json(
      apiSuccess(serializeIdentityDocument(doc), "Identity document added"),
      { status: 201 }
    );
  } catch (error) {
    console.error("Create identity document error:", error);
    return apiError("Server error", "Failed to create identity document", 500);
  }
}
