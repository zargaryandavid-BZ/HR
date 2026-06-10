import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { canGenerateHrDocuments } from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { createHrDocument } from "@/lib/individual-settings/hr-documents";

type RouteParams = { params: Promise<{ id: string }> };

const generateSchema = z.object({
  type: z.enum(["OFFER_LETTER", "WELCOME_EMAIL"]),
});

/** Generate an HR document PDF for an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canGenerateHrDocuments(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const record = await createHrDocument(
      employeeId,
      parsed.data.type,
      session.id
    );
    if (!record) {
      return apiError("Not found", "Employee not found or upload failed", 404);
    }

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "HR_DOC_GENERATED",
      targetId: employeeId,
      targetTable: "GeneratedDocument",
      newValue: {
        employeeId,
        type: parsed.data.type,
        performedBy: session.id,
      },
    });

    return Response.json(
      apiSuccess({
        id: record.id,
        type: record.type,
        fileUrl: record.fileUrl,
        generatedAt: record.generatedAt.toISOString(),
      })
    );
  } catch {
    return apiError("Server error", "Failed to generate document", 500);
  }
}
