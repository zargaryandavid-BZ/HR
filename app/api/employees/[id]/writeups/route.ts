import { NextRequest } from "next/server";
import { z } from "zod";
import { WriteUpCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canManageWriteUps,
  canViewEmployeeSettings,
} from "@/lib/individual-settings/auth";
import { resolveUserNames } from "@/lib/individual-settings/documents";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { createInAppNotification } from "@/lib/documents/service";
import { uploadWriteUpAttachment } from "@/lib/individual-settings/storage";
import type { WriteUpItem } from "@/lib/individual-settings/constants";
import { getWriteUpAcknowledgedAt } from "@/lib/writeups/constants";

type RouteParams = { params: Promise<{ id: string }> };

const createWriteUpSchema = z.object({
  category: z.nativeEnum(WriteUpCategory),
  date: z.string().min(1),
  description: z.string().min(1),
  consequence: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
});

/** Serialize write-ups with issuer names */
async function serializeWriteUps(
  writeUps: Array<{
    id: string;
    number: number;
    category: WriteUpCategory;
    date: Date;
    description: string;
    consequence: string | null;
    issuedBy: string;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
    employeeSignedAt: Date | null;
    attachmentUrl: string | null;
    createdAt: Date;
  }>
): Promise<WriteUpItem[]> {
  const nameMap = await resolveUserNames(writeUps.map((w) => w.issuedBy));
  return writeUps.map((w) => {
    const acknowledgedAt = getWriteUpAcknowledgedAt(w);
    return {
      id: w.id,
      number: w.number,
      category: w.category,
      date: w.date.toISOString(),
      description: w.description,
      consequence: w.consequence,
      issuedBy: w.issuedBy,
      issuedByName: nameMap.get(w.issuedBy) ?? "Unknown",
      acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: w.acknowledgedBy,
      attachmentUrl: w.attachmentUrl,
      createdAt: w.createdAt.toISOString(),
    };
  });
}

/** List all write-ups for an employee */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;
    if (!canViewEmployeeSettings(session, employeeId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const writeUps = await prisma.writeUp.findMany({
      where: { employeeId },
      orderBy: { number: "asc" },
    });

    return Response.json(apiSuccess(await serializeWriteUps(writeUps)));
  } catch {
    return apiError("Server error", "Failed to fetch write-ups", 500);
  }
}

/** Create a new disciplinary write-up for an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!canManageWriteUps(session)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const contentType = request.headers.get("content-type") ?? "";
    let category: WriteUpCategory;
    let date: string;
    let description: string;
    let consequence: string | undefined;
    let attachmentUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      category = formData.get("category") as WriteUpCategory;
      date = String(formData.get("date") ?? "");
      description = String(formData.get("description") ?? "");
      consequence = formData.get("consequence")
        ? String(formData.get("consequence"))
        : undefined;
      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const uploaded = await uploadWriteUpAttachment(employeeId, file);
        if (!uploaded) {
          return apiError(
            "Validation failed",
            "Attachment must be PDF, JPG, or PNG under 10MB"
          );
        }
        attachmentUrl = uploaded.url;
      }
    } else {
      const body = await request.json();
      const parsed = createWriteUpSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("Validation failed", parsed.error.errors[0]?.message);
      }
      ({ category, date, description, consequence, attachmentUrl } = parsed.data);
    }

    const parsedFields = createWriteUpSchema.safeParse({
      category,
      date,
      description,
      consequence,
      attachmentUrl,
    });
    if (!parsedFields.success) {
      return apiError("Validation failed", parsedFields.error.errors[0]?.message);
    }

    const maxRecord = await prisma.writeUp.findFirst({
      where: { employeeId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (maxRecord?.number ?? 0) + 1;

    const writeUp = await prisma.writeUp.create({
      data: {
        employeeId,
        number: nextNumber,
        category,
        date: new Date(date),
        description,
        consequence: consequence ?? null,
        issuedBy: session.id,
        attachmentUrl: attachmentUrl ?? null,
      },
    });

    await createInAppNotification({
      employeeId,
      eventType: "WRITEUP_CREATED",
      message: `A disciplinary write-up (#${nextNumber}) has been added to your record. Please review and acknowledge it.`,
      metadata: { writeupId: writeUp.id, number: nextNumber },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "WRITEUP_CREATED",
      targetId: employeeId,
      targetTable: "WriteUp",
      newValue: {
        employeeId,
        writeupId: writeUp.id,
        category,
        number: nextNumber,
        performedBy: session.id,
      },
    });

    const [serialized] = await serializeWriteUps([writeUp]);
    return Response.json(apiSuccess(serialized, "Write-up created"));
  } catch {
    return apiError("Server error", "Failed to create write-up", 500);
  }
}
