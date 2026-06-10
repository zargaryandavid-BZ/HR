import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canDeleteNote,
  isNoteAuthor,
} from "@/lib/individual-settings/auth";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";

type RouteParams = { params: Promise<{ id: string; noteId: string }> };

const updateNoteSchema = z.object({
  content: z.string().min(1),
});

/** Edit a manager note (author only) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId, noteId } = await params;
    const body = await request.json();
    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const note = await prisma.managerNote.findFirst({
      where: { id: noteId, employeeId },
    });
    if (!note) return apiError("Not found", "Note not found", 404);

    if (!isNoteAuthor(session, note.issuedBy)) {
      return apiError("Forbidden", "Only the author can edit this note", 403);
    }

    const updated = await prisma.managerNote.update({
      where: { id: noteId },
      data: { content: parsed.data.content },
    });

    return Response.json(
      apiSuccess({
        id: updated.id,
        content: updated.content,
        updatedAt: updated.updatedAt.toISOString(),
      })
    );
  } catch {
    return apiError("Server error", "Failed to update note", 500);
  }
}

/** Delete a manager note (author or SUPER_ADMIN) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId, noteId } = await params;

    const note = await prisma.managerNote.findFirst({
      where: { id: noteId, employeeId },
    });
    if (!note) return apiError("Not found", "Note not found", 404);

    if (!canDeleteNote(session, note.issuedBy)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    await prisma.managerNote.delete({ where: { id: noteId } });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "NOTE_DELETED",
      targetId: employeeId,
      targetTable: "ManagerNote",
      newValue: { employeeId, noteId, performedBy: session.id },
    });

    return Response.json(apiSuccess(null, "Note deleted"));
  } catch {
    return apiError("Server error", "Failed to delete note", 500);
  }
}
