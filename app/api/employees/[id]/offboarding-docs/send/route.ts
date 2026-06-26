import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  listSendableOffboardingDocuments,
  sendSelectedOffboardingDocuments,
} from "@/lib/offboarding/assignments";

type RouteParams = { params: Promise<{ id: string }> };

const postSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, "Select at least one document"),
});

/** Send selected offboarding documents to the employee portal */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid request");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const result = await sendSelectedOffboardingDocuments(
      employeeId,
      parsed.data.documentIds,
      session.id
    );

    if (result.sent === 0) {
      return apiError("Validation failed", "No eligible documents to send");
    }

    return Response.json(
      apiSuccess(
        { sent: result.sent, employeeName: result.employeeName },
        `${result.sent} document${result.sent !== 1 ? "s" : ""} sent`
      )
    );
  } catch (error) {
    console.error("Send offboarding docs error:", error);
    return apiError("Server error", "Failed to send documents", 500);
  }
}

/** List non-HR-approved offboarding documents for the send dialog */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const sendable = await listSendableOffboardingDocuments(employeeId);

    return Response.json(apiSuccess(sendable));
  } catch (error) {
    console.error("List sendable offboarding docs error:", error);
    return apiError("Server error", "Failed to fetch documents", 500);
  }
}
