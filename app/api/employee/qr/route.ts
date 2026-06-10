import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Returns the employee's QR token and latest clock event */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { qrCodeToken: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const latestEntry = await prisma.timeEntry.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { timestamp: "desc" },
      select: { eventType: true, timestamp: true },
    });

    return Response.json(
      apiSuccess({
        qrCodeToken: employee.qrCodeToken,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        clockStatus: latestEntry
          ? {
              type: latestEntry.eventType,
              timestamp: latestEntry.timestamp.toISOString(),
            }
          : null,
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch QR data", 500);
  }
}
