import { NextRequest } from "next/server";
import { format } from "date-fns";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import {
  countUploadedDocuments,
  resolveShareLinkStatus,
} from "@/lib/document-share/service";

type RouteParams = { params: Promise<{ id: string }> };

/** List sent document share links for an employee */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const links = await prisma.documentShareLink.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    const { total, uploaded } = await countUploadedDocuments(employeeId);

    const items = links.map((link) => ({
      id: link.id,
      channel: link.channel,
      recipient: link.recipient,
      sentAt: format(link.createdAt, "MMM d, yyyy"),
      expiresAt: format(link.expiresAt, "MMM d, yyyy"),
      status: resolveShareLinkStatus(link, uploaded, total),
      viewedAt: link.viewedAt?.toISOString() ?? null,
      completedAt: link.completedAt?.toISOString() ?? null,
    }));

    return Response.json(apiSuccess(items));
  } catch {
    return apiError("Server error", "Failed to fetch share links", 500);
  }
}
