import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { deleteHrDocumentByUrl } from "@/lib/individual-settings/storage";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";

type RouteParams = { params: Promise<{ id: string; generatedDocumentId: string }> };

/** Delete a generated HR document for an employee */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, generatedDocumentId } = await params;

    const doc = await prisma.generatedDocument.findFirst({
      where: { id: generatedDocumentId, employeeId },
    });
    if (!doc) return apiError("Not found", "Document not found", 404);

    await deleteHrDocumentByUrl(doc.fileUrl);
    await prisma.generatedDocument.delete({ where: { id: doc.id } });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "HR_DOCUMENT_REMOVED",
      targetId: employeeId,
      targetTable: "GeneratedDocument",
      oldValue: {
        employeeId,
        generatedDocumentId: doc.id,
        type: doc.type,
        fileUrl: doc.fileUrl,
      },
    });

    return Response.json(apiSuccess(null, "HR document removed"));
  } catch (error) {
    console.error("Delete generated HR document error:", error);
    return apiError("Server error", "Failed to remove HR document", 500);
  }
}
