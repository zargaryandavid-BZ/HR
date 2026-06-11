import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal endpoint called by middleware to verify the employee in the session
 * still exists and is active. Returns 200 OK or 401.
 */
export async function POST(request: NextRequest) {
  try {
    const { employeeId } = (await request.json()) as { employeeId?: string };
    if (!employeeId) return new Response("Bad request", { status: 400 });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, status: "ACTIVE" },
      select: { id: true },
    });

    if (!employee) return new Response("Invalid session", { status: 401 });
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
