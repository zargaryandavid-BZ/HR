import { NextRequest } from "next/server";
import { z } from "zod";
import { WriteUpCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canDeleteWriteUps,
  canManageWriteUps,
} from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { uploadWriteUpAttachment } from "@/lib/individual-settings/storage";

type RouteParams = { params: Promise<{ id: string; writeupId: string }> };

const updateWriteUpSchema = z.object({
  description: z.string().min(1).optional(),
  consequence: z.string().nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  category: z.nativeEnum(WriteUpCategory).optional(),
  date: z.string().optional(),
});

/** Update a disciplinary write-up (HR admin only) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canManageWriteUps(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, writeupId } = await params;

    const writeUp = await prisma.writeUp.findFirst({
      where: { id: writeupId, employeeId },
    });
    if (!writeUp) return apiError("Not found", "Write-up not found", 404);

    const contentType = request.headers.get("content-type") ?? "";
    let data: z.infer<typeof updateWriteUpSchema>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      data = {
        description: String(formData.get("description") ?? ""),
        consequence: formData.get("consequence")
          ? String(formData.get("consequence"))
          : null,
        category: formData.get("category") as WriteUpCategory,
        date: String(formData.get("date") ?? ""),
      };
      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const uploaded = await uploadWriteUpAttachment(employeeId, file);
        if (!uploaded) {
          return apiError(
            "Validation failed",
            "Attachment must be PDF, JPG, or PNG under 10MB"
          );
        }
        data.attachmentUrl = uploaded.url;
      }
    } else {
      const body = await request.json();
      const parsed = updateWriteUpSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("Validation failed", parsed.error.errors[0]?.message);
      }
      data = parsed.data;
    }

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.consequence !== undefined) updateData.consequence = data.consequence;
    if (data.attachmentUrl !== undefined) updateData.attachmentUrl = data.attachmentUrl;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    const updated = await prisma.writeUp.update({
      where: { id: writeupId },
      data: updateData,
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "WRITEUP_UPDATED",
      targetId: employeeId,
      targetTable: "WriteUp",
      oldValue: {
        description: writeUp.description,
        consequence: writeUp.consequence,
        attachmentUrl: writeUp.attachmentUrl,
      },
      newValue: { writeupId, changes: data, performedBy: session.id },
    });

    return Response.json(
      apiSuccess({
        id: updated.id,
        acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
        acknowledgedBy: updated.acknowledgedBy,
      })
    );
  } catch {
    return apiError("Server error", "Failed to update write-up", 500);
  }
}

/** Delete a disciplinary write-up (SUPER_ADMIN only) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canDeleteWriteUps(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId, writeupId } = await params;

    const writeUp = await prisma.writeUp.findFirst({
      where: { id: writeupId, employeeId },
    });
    if (!writeUp) return apiError("Not found", "Write-up not found", 404);

    await prisma.writeUp.delete({ where: { id: writeupId } });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "WRITEUP_DELETED",
      targetId: employeeId,
      targetTable: "WriteUp",
      newValue: { employeeId, writeupId, performedBy: session.id },
    });

    return Response.json(apiSuccess(null, "Write-up deleted"));
  } catch {
    return apiError("Server error", "Failed to delete write-up", 500);
  }
}
