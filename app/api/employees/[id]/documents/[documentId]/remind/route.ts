import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canRemindDocuments } from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { sendDocumentCompletionReminder } from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

/** Send a document completion reminder until HR confirms the document */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canRemindDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, documentId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const document = await prisma.sop.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, isActive: true },
    });
    if (!document || !document.isActive) {
      return apiError("Not found", "Document not found", 404);
    }

    const result = await sendDocumentCompletionReminder({
      employeeId,
      documentId: document.id,
      documentTitle: document.title,
    });

    if (result.error === "not_assigned") {
      return apiError("Not found", "Document not assigned to employee", 404);
    }
    if (result.error === "already_confirmed") {
      return apiError("Already confirmed", "Document is already HR approved", 400);
    }

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "DOCUMENT_REMINDED",
      targetId: employeeId,
      targetTable: "Employee",
      newValue: { employeeId, documentId: document.id, performedBy: session.id },
    });

    return Response.json(apiSuccess(null, "Reminder sent"));
  } catch {
    return apiError("Server error", "Failed to send reminder", 500);
  }
}
