import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

/** Returns the employee's time entries for the last 4 weeks */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const now = new Date();
    const from = startOfWeek(subWeeks(now, 3), { weekStartsOn: 1 });
    const to = endOfWeek(now, { weekStartsOn: 1 });

    const entries = await prisma.timeEntry.findMany({
      where: {
        employeeId: session.employeeId,
        clockIn: { gte: from, lte: to },
      },
      include: { breaks: { orderBy: { startedAt: "asc" } } },
      orderBy: { clockIn: "desc" },
    });

    return Response.json(apiSuccess(entries));
  } catch {
    return apiError("Server error", "Failed to load time entries", 500);
  }
}
