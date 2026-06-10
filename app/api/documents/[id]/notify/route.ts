import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { documentNotifySchema } from "@/lib/validations";
import { logDocumentAudit, notifyEmployees } from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string }> };

/** Send version-update notifications to all assigned employees */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = documentNotifySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const document = await prisma.sop.findUnique({
      where: { id },
      include: { assignments: { select: { employeeId: true } } },
    });
    if (!document) return apiError("Not found", "Document not found", 404);

    const employeeIds = document.assignments.map((a) => a.employeeId);
    const message = `The document '${document.title}' has been updated to version ${parsed.data.version}. Please review the latest version.`;

    await notifyEmployees(employeeIds, "DOCUMENT_UPDATED", message, {
      documentId: document.id,
      documentTitle: document.title,
      version: parsed.data.version,
    });

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_UPDATED_NOTIFIED",
      targetId: document.id,
      newValue: {
        version: parsed.data.version,
        affectedEmployeeCount: employeeIds.length,
      },
    });

    return Response.json(apiSuccess({ notified: employeeIds.length }));
  } catch {
    return apiError("Server error", "Failed to send notifications", 500);
  }
}
