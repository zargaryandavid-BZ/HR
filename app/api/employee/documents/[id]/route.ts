import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { onboardingAssignmentKey } from "@/lib/documents/assignment-keys";
import { logDocumentAudit } from "@/lib/documents/service";

type RouteParams = { params: Promise<{ id: string }> };

/** Acknowledge the current version of an assigned document */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!session.employeeId) {
      return apiError("Forbidden", "No employee profile linked", 403);
    }

    const { id } = await params;

    const assignment = await prisma.documentAssignment.findUnique({
      where: {
        sopId_employeeId_isOffboarding: onboardingAssignmentKey(id, session.employeeId),
      },
      include: { sop: true },
    });

    if (!assignment) {
      return apiError("Forbidden", "Document not assigned to you", 403);
    }

    const acknowledgment = await prisma.sopAcknowledgment.upsert({
      where: {
        sopId_employeeId_sopVersion: {
          sopId: id,
          employeeId: session.employeeId,
          sopVersion: assignment.sop.version,
        },
      },
      create: {
        sopId: id,
        employeeId: session.employeeId,
        sopVersion: assignment.sop.version,
      },
      update: { acknowledgedAt: new Date() },
    });

    await logDocumentAudit({
      userId: session.id,
      action: "DOCUMENT_ACKNOWLEDGED",
      targetId: id,
      newValue: {
        employeeId: session.employeeId,
        version: assignment.sop.version,
      },
    });

    return Response.json(
      apiSuccess({
        acknowledgedAt: acknowledgment.acknowledgedAt.toISOString(),
        version: assignment.sop.version,
      })
    );
  } catch {
    return apiError("Server error", "Failed to acknowledge document", 500);
  }
}

/** Resolve latest document details for onboarding Document Sign steps */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id } = await params;
    const document = await prisma.sop.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        documentType: true,
        version: true,
        fileUrl: true,
        isActive: true,
      },
    });

    if (!document || !document.isActive) {
      return apiError("Not found", "Document not found", 404);
    }

    return Response.json(apiSuccess(document));
  } catch {
    return apiError("Server error", "Failed to fetch document", 500);
  }
}
