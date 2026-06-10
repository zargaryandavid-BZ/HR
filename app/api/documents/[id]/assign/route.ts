import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { documentAssignSchema } from "@/lib/validations";
import {
  logDocumentAudit,
  syncPositionSpecificAssignments,
} from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string }> };

/** Get current assignments and links for a document */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const [assignments, links] = await Promise.all([
      prisma.documentAssignment.findMany({
        where: { sopId: id },
        select: { employeeId: true },
      }),
      prisma.documentPositionLink.findMany({
        where: { documentId: id },
        select: { positionId: true, departmentId: true },
      }),
    ]);

    return Response.json(
      apiSuccess({
        employeeIds: assignments.map((a) => a.employeeId),
        positionIds: links.filter((l) => l.positionId).map((l) => l.positionId!),
        departmentIds: links.filter((l) => l.departmentId).map((l) => l.departmentId!),
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch assignments", 500);
  }
}

/** Save position, department, and individual employee assignments */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = documentAssignSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const document = await prisma.sop.findUnique({ where: { id } });
    if (!document) return apiError("Not found", "Document not found", 404);
    if (document.scope === "COMPANY_WIDE") {
      return apiError("Invalid", "Company-wide documents cannot be manually assigned", 400);
    }

    const existing = await prisma.documentAssignment.findMany({
      where: { sopId: id },
      select: { employeeId: true },
    });
    const existingIds = new Set(existing.map((a) => a.employeeId));

    const result = await syncPositionSpecificAssignments({
      sopId: id,
      positionIds: parsed.data.positionIds,
      departmentIds: parsed.data.departmentIds,
      employeeIds: parsed.data.employeeIds,
      assignedById: session.id,
      documentTitle: document.title,
    });

    await prisma.sop.update({
      where: { id },
      data: { scope: "POSITION_SPECIFIC" },
    });

    const updated = await prisma.documentAssignment.findMany({
      where: { sopId: id },
      select: { employeeId: true },
    });
    const updatedIds = new Set(updated.map((a) => a.employeeId));
    const newlyAssigned = [...updatedIds].filter((eid) => !existingIds.has(eid));

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_ASSIGNED",
      targetId: document.id,
      newValue: {
        positionIds: parsed.data.positionIds,
        departmentIds: parsed.data.departmentIds,
        employeeIds: parsed.data.employeeIds,
        newlyAssigned,
      },
    });

    return Response.json(
      apiSuccess({ added: result.added, removed: result.removed, newlyAssigned })
    );
  } catch {
    return apiError("Server error", "Failed to save assignments", 500);
  }
}
