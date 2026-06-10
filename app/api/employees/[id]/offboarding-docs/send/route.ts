import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendUnsentOffboardingDocuments } from "@/lib/offboarding/assignments";

type RouteParams = { params: Promise<{ id: string }> };

/** Send all unsent offboarding documents to the employee portal */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const result = await sendUnsentOffboardingDocuments(employeeId, session.id);

    if (result.sent === 0) {
      return apiError("Validation failed", "All offboarding documents have already been sent");
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

/** List unsent offboarding documents for the send confirmation dialog */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const unsent = await prisma.documentAssignment.findMany({
      where: {
        employeeId,
        isOffboarding: true,
        offboardingSentAt: null,
        sop: { isActive: true, status: "ACTIVE" },
      },
      include: {
        sop: { select: { id: true, title: true, documentType: true } },
      },
      orderBy: { sop: { title: "asc" } },
    });

    return Response.json(
      apiSuccess(
        unsent.map((row) => ({
          id: row.sop.id,
          title: row.sop.title,
          documentType: row.sop.documentType,
        }))
      )
    );
  } catch (error) {
    console.error("List unsent offboarding docs error:", error);
    return apiError("Server error", "Failed to fetch unsent documents", 500);
  }
}
