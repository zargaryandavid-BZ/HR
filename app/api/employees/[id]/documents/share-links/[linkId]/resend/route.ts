import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { resendDocumentShareLink } from "@/lib/document-share/service";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

/** Resend an existing document share link */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, linkId } = await params;

    const link = await prisma.documentShareLink.findFirst({
      where: { id: linkId, employeeId },
    });
    if (!link) return apiError("Not found", "Share link not found", 404);

    if (link.expiresAt < new Date()) {
      return apiError("Validation failed", "Link has expired — send a new one");
    }

    const result = await resendDocumentShareLink(linkId, session.id);
    if (!result) return apiError("Server error", "Failed to resend link", 500);

    return Response.json(apiSuccess({ linkUrl: result.linkUrl }, "Link resent"));
  } catch {
    return apiError("Server error", "Failed to resend link", 500);
  }
}
