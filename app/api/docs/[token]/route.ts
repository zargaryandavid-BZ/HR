import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getShareableDocuments,
  validateShareToken,
} from "@/lib/document-share/service";

type RouteParams = { params: Promise<{ token: string }> };

/** Public API to load documents for a share token (no auth) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const validation = await validateShareToken(token);

    if ("error" in validation) {
      if (validation.error === "expired") {
        return apiError("Expired", "This link has expired", 410);
      }
      return apiError("Not found", "Invalid link", 404);
    }

    const { link } = validation;
    const allDocuments = await getShareableDocuments(link.employeeId);
    const selected = link.selectedDocumentIds ?? [];
    const documents =
      selected.length > 0
        ? allDocuments.filter((d) => selected.includes(d.id))
        : allDocuments;

    const sopDescriptions = await prisma.sop.findMany({
      where: { id: { in: documents.map((d) => d.id) } },
      select: { id: true, description: true },
    });
    const descMap = new Map(sopDescriptions.map((s) => [s.id, s.description]));

    const uploaded = documents.filter((d) => d.signedFileUrl).length;

    return Response.json(
      apiSuccess({
        employee: {
          firstName: link.employee.preferredName ?? link.employee.firstName,
        },
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          documentType: d.documentType,
          version: d.version,
          fileUrl: d.fileUrl,
          description: descMap.get(d.id) ?? "",
          signedFileUrl: d.signedFileUrl,
          signedAt: d.signedAt,
        })),
        progress: { completed: uploaded, total: documents.length },
        expiresAt: link.expiresAt.toISOString(),
      })
    );
  } catch {
    return apiError("Server error", "Failed to load documents", 500);
  }
}
