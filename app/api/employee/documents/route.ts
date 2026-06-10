import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { getEmployeeDocumentsWithStatus } from "@/lib/individual-settings/documents";

/** Returns onboarding document assignments with status for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const documents = await getEmployeeDocumentsWithStatus(session.employeeId, {
      sentOnly: true,
    });
    return Response.json(apiSuccess(documents));
  } catch {
    return apiError("Server error", "Failed to fetch documents", 500);
  }
}
