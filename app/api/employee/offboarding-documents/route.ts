import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { getEmployeeOffboardingDocuments } from "@/lib/individual-settings/offboarding-documents";

/** Returns sent offboarding document assignments for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const documents = await getEmployeeOffboardingDocuments(session.employeeId, {
      sentOnly: true,
    });

    const instance = await prisma.offboardingInstance.findFirst({
      where: { employeeId: session.employeeId, status: "IN_PROGRESS" },
      select: { lastDayDate: true },
      orderBy: { createdAt: "desc" },
    });

    const allDocs = [...documents.autoAssigned, ...documents.manuallyAssigned];
    if (allDocs.length === 0) {
      return Response.json(apiSuccess({ autoAssigned: [], manuallyAssigned: [], instance: null }));
    }

    return Response.json(
      apiSuccess({
        ...documents,
        instance: instance
          ? { lastDayDate: instance.lastDayDate?.toISOString() ?? null }
          : null,
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch offboarding documents", 500);
  }
}
