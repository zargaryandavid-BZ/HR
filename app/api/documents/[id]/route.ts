import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { documentUpdateSchema } from "@/lib/validations";
import {
  documentInclude,
  logDocumentAudit,
  serializeDocument,
  syncDocumentScopeAssignments,
} from "@/lib/documents/service";
import { getFileNameFromUrl } from "@/lib/documents/storage";

type RouteParams = { params: Promise<{ id: string }> };

/** Get a single document by ID */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const document = await prisma.sop.findUnique({
      where: { id },
      include: documentInclude,
    });

    if (!document) return apiError("Not found", "Document not found", 404);

    return Response.json(
      apiSuccess(
        serializeDocument(document, { fileName: getFileNameFromUrl(document.fileUrl) })
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch document", 500);
  }
}

/** Update a document; increments version when a new file URL is provided */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = documentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const existing = await prisma.sop.findUnique({ where: { id } });
    if (!existing) return apiError("Not found", "Document not found", 404);

    const newFileUploaded = !!parsed.data.fileUrl && parsed.data.fileUrl !== existing.fileUrl;
    const nextVersion = newFileUploaded ? existing.version + 1 : existing.version;
    const resolvedScope = parsed.data.scope ?? existing.scope;

    const document = await prisma.sop.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.documentType !== undefined && { documentType: parsed.data.documentType }),
        ...(parsed.data.fileUrl !== undefined && { fileUrl: parsed.data.fileUrl }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.scope !== undefined && { scope: parsed.data.scope }),
        ...(newFileUploaded && { version: nextVersion }),
        ...(resolvedScope === "COMPANY_WIDE" && {
          departmentIds: [],
          positionIds: [],
        }),
        ...(resolvedScope === "POSITION_SPECIFIC" &&
          parsed.data.departmentIds !== undefined && {
            departmentIds: parsed.data.departmentIds,
          }),
        ...(resolvedScope === "POSITION_SPECIFIC" &&
          parsed.data.positionIds !== undefined && {
            positionIds: parsed.data.positionIds,
          }),
      },
      include: {
        ...documentInclude,
        assignments: { select: { employeeId: true } },
      },
    });

    if (newFileUploaded) {
      await prisma.documentAssignment.updateMany({
        where: { sopId: id },
        data: { signedFileUrl: null, signedAt: null, acknowledgedAt: null },
      });
    }

    const scopeChanged =
      parsed.data.scope !== undefined ||
      parsed.data.departmentIds !== undefined ||
      parsed.data.positionIds !== undefined;

    if (scopeChanged || parsed.data.scope === "COMPANY_WIDE") {
      await syncDocumentScopeAssignments({
        sopId: id,
        scope: resolvedScope,
        positionIds: document.positionIds,
        departmentIds: document.departmentIds,
        assignedById: session.id,
        documentTitle: document.title,
      });
    }

    const refreshed = await prisma.sop.findUnique({
      where: { id },
      include: {
        ...documentInclude,
        assignments: { select: { employeeId: true } },
      },
    });

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_UPDATED",
      targetId: document.id,
      oldValue: { version: existing.version, fileUrl: existing.fileUrl },
      newValue: { version: document.version, fileUrl: document.fileUrl },
    });

    return Response.json(
      apiSuccess({
        ...serializeDocument(refreshed!, { fileName: getFileNameFromUrl(document.fileUrl) }),
        versionIncremented: newFileUploaded,
        assignedEmployeeIds: refreshed!.assignments.map((a) => a.employeeId),
        assignedCount: refreshed!._count.assignments,
      })
    );
  } catch {
    return apiError("Server error", "Failed to update document", 500);
  }
}

/** Archive a document (soft delete) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const document = await prisma.sop.update({
      where: { id },
      data: { status: "ARCHIVED", isActive: false },
      include: documentInclude,
    });

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_ARCHIVED",
      targetId: document.id,
      reason: "Document archived by HR Admin",
    });

    return Response.json(apiSuccess(serializeDocument(document), "Document archived"));
  } catch {
    return apiError("Server error", "Failed to archive document", 500);
  }
}
