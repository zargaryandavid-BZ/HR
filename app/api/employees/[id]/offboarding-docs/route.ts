import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { offboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { logDocumentAudit } from "@/lib/documents/service";
import { ensureOffboardingInstance } from "@/lib/offboarding/assignments";
import { getEmployeeOffboardingDocuments } from "@/lib/individual-settings/offboarding-documents";
import { canViewEmployeeSettings } from "@/lib/individual-settings/auth";

const assignSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

/** List offboarding documents for an employee */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;
    if (!canViewEmployeeSettings(session, employeeId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const documents = await getEmployeeOffboardingDocuments(employeeId);
    const instance = await prisma.offboardingInstance.findFirst({
      where: { employeeId, status: "IN_PROGRESS" },
      select: {
        id: true,
        lastDayDate: true,
        initiatedAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess({ ...documents, instance }));
  } catch {
    return apiError("Server error", "Failed to fetch offboarding documents", 500);
  }
}

/** Manually assign offboarding documents (unsent until HR sends) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    await ensureOffboardingInstance(employeeId, session.id);

    const activeDocs = await prisma.sop.findMany({
      where: {
        id: { in: parsed.data.documentIds },
        isActive: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const validIds = new Set(activeDocs.map((doc) => doc.id));

    let assigned = 0;
    let skipped = 0;

    for (const documentId of parsed.data.documentIds) {
      if (!validIds.has(documentId)) {
        skipped++;
        continue;
      }

      const existing = await prisma.documentAssignment.findUnique({
        where: {
          sopId_employeeId_isOffboarding: offboardingAssignmentKey(documentId, employeeId),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.documentAssignment.create({
        data: {
          sopId: documentId,
          employeeId,
          assignedById: session.id,
          assignedManually: true,
          isOffboarding: true,
          offboardingSentAt: null,
        },
      });

      await logDocumentAudit({
        userId: session.id,
        action: "OFFBOARDING_DOC_MANUALLY_ASSIGNED",
        targetId: documentId,
        targetTable: "DocumentAssignment",
        newValue: { employeeId, documentId, assignedById: session.id },
      });

      assigned++;
    }

    return Response.json(apiSuccess({ assigned, skipped }));
  } catch (error) {
    console.error("Assign offboarding docs error:", error);
    return apiError("Server error", "Failed to assign documents", 500);
  }
}

/** Remove an offboarding document assignment */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const documentId = request.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return apiError("Validation failed", "documentId is required");
    }

    const assignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: offboardingAssignmentKey(documentId, employeeId),
      },
    });

    if (!assignment) {
      return apiError("Not found", "Assignment not found", 404);
    }

    await prisma.documentAssignment.delete({ where: { id: assignment.id } });

    return Response.json(apiSuccess(null, "Document removed"));
  } catch {
    return apiError("Server error", "Failed to remove document", 500);
  }
}
