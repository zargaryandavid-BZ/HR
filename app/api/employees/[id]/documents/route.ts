import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { syncEmployeeDocumentAssignments } from "@/lib/documents/assignments";
import { canViewEmployeeSettings } from "@/lib/individual-settings/auth";
import { getEmployeeDocumentsWithStatus } from "@/lib/individual-settings/documents";

type RouteParams = { params: Promise<{ id: string }> };

/** List company-wide and assigned documents for an employee with completion status */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;

    if (!canViewEmployeeSettings(session, employeeId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    if (["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      await syncEmployeeDocumentAssignments(employeeId, session.id);
    }

    const documents = await getEmployeeDocumentsWithStatus(employeeId);
    return Response.json(apiSuccess(documents));
  } catch {
    return apiError("Server error", "Failed to fetch employee documents", 500);
  }
}
