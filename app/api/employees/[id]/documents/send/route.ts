import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { sendDocumentShareLink } from "@/lib/document-share/service";

type RouteParams = { params: Promise<{ id: string }> };

const sendSchema = z.object({
  channel: z.enum(["SMS", "EMAIL"]),
  recipient: z.string().min(1),
  selectedDocumentIds: z.array(z.string()).optional().default([]),
});

/** Send a secure document share link to a new hire via SMS or email */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const result = await sendDocumentShareLink({
      employeeId,
      channel: parsed.data.channel,
      recipient: parsed.data.recipient,
      createdBy: session.id,
      selectedDocumentIds: parsed.data.selectedDocumentIds,
    });

    if (!result) return apiError("Server error", "Failed to send link", 500);

    return Response.json(
      apiSuccess({ linkUrl: result.linkUrl, shareLinkId: result.shareLink.id })
    );
  } catch {
    return apiError("Server error", "Failed to send document link", 500);
  }
}
