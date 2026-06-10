import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { documentCreateSchema } from "@/lib/validations";
import {
  documentInclude,
  logDocumentAudit,
  serializeDocument,
  syncDocumentScopeAssignments,
} from "@/lib/documents/service";
import { getFileNameFromUrl } from "@/lib/documents/storage";
import type { DocumentType } from "@prisma/client";

/** List documents with optional search and filters */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim();
    const type = searchParams.get("type") as DocumentType | "ALL" | null;
    const status = searchParams.get("status");

    const where: {
      title?: { contains: string; mode: "insensitive" };
      documentType?: DocumentType;
      isActive?: boolean;
      status?: "ARCHIVED" | { not: "ARCHIVED" };
    } = {};

    if (search) where.title = { contains: search, mode: "insensitive" };
    if (type && type !== "ALL") where.documentType = type;

    if (status === "archived") {
      where.status = "ARCHIVED";
    } else {
      where.status = { not: "ARCHIVED" };
      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
    }

    const documents = await prisma.sop.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: documentInclude,
    });

    return Response.json(
      apiSuccess(
        documents.map((doc) =>
          serializeDocument(doc, { fileName: getFileNameFromUrl(doc.fileUrl) })
        )
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch documents", 500);
  }
}

/** Create a new document in the repository */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const body = await request.json();
    const parsed = documentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const document = await prisma.sop.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        documentType: parsed.data.documentType,
        scope: parsed.data.scope,
        fileUrl: parsed.data.fileUrl,
        isActive: parsed.data.isActive,
        uploadedById: session.id,
        departmentIds: parsed.data.scope === "POSITION_SPECIFIC" ? parsed.data.departmentIds : [],
        positionIds: parsed.data.scope === "POSITION_SPECIFIC" ? parsed.data.positionIds : [],
      },
      include: documentInclude,
    });

    await syncDocumentScopeAssignments({
      sopId: document.id,
      scope: parsed.data.scope,
      positionIds: parsed.data.positionIds,
      departmentIds: parsed.data.departmentIds,
      assignedById: session.id,
      documentTitle: document.title,
    });

    const refreshed = await prisma.sop.findUnique({
      where: { id: document.id },
      include: documentInclude,
    });

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_CREATED",
      targetId: document.id,
      newValue: {
        title: document.title,
        documentType: document.documentType,
        scope: document.scope,
        version: document.version,
      },
    });

    return Response.json(
      apiSuccess(
        serializeDocument(refreshed!, { fileName: getFileNameFromUrl(document.fileUrl) }),
        "Document created"
      ),
      { status: 201 }
    );
  } catch {
    return apiError("Server error", "Failed to create document", 500);
  }
}
