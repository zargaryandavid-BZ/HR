import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { createInAppNotification } from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string }> };

const sendSchema = z.object({
  generatedDocumentId: z.string().min(1),
});

const TYPE_LABELS = {
  OFFER_LETTER: "Offer Letter",
  WELCOME_EMAIL: "Welcome Email",
} as const;

/** Send a generated HR document to the employee via in-app notification */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const doc = await prisma.generatedDocument.findFirst({
      where: { id: parsed.data.generatedDocumentId, employeeId },
    });
    if (!doc) return apiError("Not found", "Generated document not found", 404);

    const label = TYPE_LABELS[doc.type];

    await createInAppNotification({
      employeeId,
      eventType: "HR_DOCUMENT_READY",
      message: `Your ${label} is ready. Click to download.`,
      metadata: {
        generatedDocumentId: doc.id,
        type: doc.type,
        fileUrl: doc.fileUrl,
        link: doc.fileUrl,
      },
    });

    return Response.json(apiSuccess(null, "Document sent to employee"));
  } catch {
    return apiError("Server error", "Failed to send document", 500);
  }
}
