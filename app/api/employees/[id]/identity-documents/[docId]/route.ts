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
import {
  deleteIdentityDocumentFile,
  uploadIdentityDocumentFile,
} from "@/lib/identity-documents/storage";
import { validateIdentityDocumentForm } from "@/lib/identity-documents/validation";
import { isEncryptionConfigured } from "@/lib/utils/encryption";

type RouteParams = { params: Promise<{ id: string; docId: string }> };

/** Parse optional multipart fields for identity document update */
async function parsePatchForm(request: NextRequest) {
  const formData = await request.formData();
  const result: {
    documentNumber?: string | null;
    country?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
    file?: File | null;
    clearExpiry?: boolean;
  } = {};

  if (formData.has("documentNumber")) {
    const raw = formData.get("documentNumber");
    result.documentNumber = raw != null ? String(raw).trim() || null : null;
  }
  if (formData.has("country")) {
    const raw = formData.get("country");
    result.country = raw != null ? String(raw).trim() || null : null;
  }
  if (formData.has("expiryDate")) {
    const raw = formData.get("expiryDate");
    result.expiryDate = raw != null ? String(raw).trim() || null : null;
    result.clearExpiry = raw != null && String(raw).trim() === "";
  }
  if (formData.has("notes")) {
    const raw = formData.get("notes");
    result.notes = raw != null ? String(raw).trim() || null : null;
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    result.file = file;
  }

  return result;
}

/** Update an identity document */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, docId } = await params;

    const existing = await prisma.employeeIdentityDocument.findFirst({
      where: { id: docId, employeeId },
    });
    if (!existing) return apiError("Not found", "Identity document not found", 404);

    const parsed = await parsePatchForm(request);

    const validationError = validateIdentityDocumentForm(
      {
        docType: existing.docType,
        documentNumber: parsed.documentNumber,
        country: parsed.country,
        expiryDate: parsed.expiryDate,
        notes: parsed.notes,
        file: parsed.file,
      },
      "update"
    );
    if (validationError) {
      return apiError("Validation failed", validationError);
    }

    if (parsed.documentNumber?.trim() && !isEncryptionConfigured()) {
      return apiError(
        "Server configuration error",
        "Document numbers cannot be saved until ENCRYPTION_KEY is configured on the server",
        503
      );
    }

    let fileUrl = existing.fileUrl;
    let fileName = existing.fileName;

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

    const updated = await prisma.employeeIdentityDocument.update({
      where: { id: docId },
      data: {
        ...(parsed.documentNumber !== undefined && {
          documentNumber: encryptDocumentNumber(
            parsed.documentNumber,
            existing.docType
          ),
        }),
        ...(parsed.country !== undefined && { country: parsed.country }),
        ...(parsed.expiryDate !== undefined && {
          expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null,
        }),
        ...(parsed.notes !== undefined && { notes: parsed.notes }),
        ...(parsed.file && { fileUrl, fileName }),
      },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "IDENTITY_DOCUMENT_UPDATED",
      targetId: docId,
      targetTable: "EmployeeIdentityDocument",
      newValue: { employeeId, docType: existing.docType as IdDocType, updatedBy: session.id },
    });

    return Response.json(
      apiSuccess(serializeIdentityDocument(updated), "Identity document updated")
    );
  } catch (error) {
    console.error("Update identity document error:", error);
    return apiError("Server error", "Failed to update identity document", 500);
  }
}

/** Delete an identity document (Super Admin only) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (session.role !== "SUPER_ADMIN") {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, docId } = await params;

    const existing = await prisma.employeeIdentityDocument.findFirst({
      where: { id: docId, employeeId },
    });
    if (!existing) return apiError("Not found", "Identity document not found", 404);

    await prisma.employeeIdentityDocument.delete({ where: { id: docId } });
    await deleteIdentityDocumentFile(existing.fileUrl);

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "IDENTITY_DOCUMENT_DELETED",
      targetId: docId,
      targetTable: "EmployeeIdentityDocument",
      oldValue: { employeeId, docType: existing.docType },
    });

    return Response.json(apiSuccess(null, "Identity document deleted"));
  } catch (error) {
    console.error("Delete identity document error:", error);
    return apiError("Server error", "Failed to delete identity document", 500);
  }
}
