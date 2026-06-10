import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canCreateNoteForEmployee,
  canViewNotes,
} from "@/lib/individual-settings/auth";
import { resolveUserNames } from "@/lib/individual-settings/documents";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import type { ManagerNoteItem } from "@/lib/individual-settings/constants";

type RouteParams = { params: Promise<{ id: string }> };

const createNoteSchema = z.object({
  content: z.string().min(1),
});

/** Serialize manager notes with author names */
async function serializeNotes(
  notes: Array<{
    id: string;
    content: string;
    issuedBy: string;
    createdAt: Date;
    updatedAt: Date;
  }>
): Promise<ManagerNoteItem[]> {
  const nameMap = await resolveUserNames(notes.map((n) => n.issuedBy));
  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    issuedBy: n.issuedBy,
    issuedByName: nameMap.get(n.issuedBy) ?? "Unknown",
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

/** List manager notes for an employee */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    if (!canViewNotes(session, employeeId, employee.departmentId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const notes = await prisma.managerNote.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(apiSuccess(await serializeNotes(notes)));
  } catch {
    return apiError("Server error", "Failed to fetch notes", 500);
  }
}

/** Create a manager note for an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, departmentId: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    if (!canCreateNoteForEmployee(session, employee.departmentId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const note = await prisma.managerNote.create({
      data: {
        employeeId,
        content: parsed.data.content,
        issuedBy: session.id,
      },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "NOTE_CREATED",
      targetId: employeeId,
      targetTable: "ManagerNote",
      newValue: { employeeId, noteId: note.id, performedBy: session.id },
    });

    const [serialized] = await serializeNotes([note]);
    return Response.json(apiSuccess(serialized, "Note created"));
  } catch {
    return apiError("Server error", "Failed to create note", 500);
  }
}
