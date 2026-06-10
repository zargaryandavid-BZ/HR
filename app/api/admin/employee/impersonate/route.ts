import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Generate a one-time 5-minute impersonation token so HR Admin can open an employee's portal directly */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const { employeeId } = body as { employeeId?: string };

    if (!employeeId) {
      return apiError("BAD_REQUEST", "employeeId is required", 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, status: true },
    });

    if (!employee) {
      return apiError("NOT_FOUND", "Employee not found", 404);
    }
    if (employee.status !== "ACTIVE") {
      return apiError("FORBIDDEN", "Cannot impersonate an inactive employee", 403);
    }

    // Single-use, 5-minute expiry
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.employeeImpersonationToken.create({
      data: {
        token,
        employeeId,
        createdBy: session.id,
        expiresAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "EMPLOYEE_PORTAL_ACCESSED",
        targetId: employeeId,
        targetTable: "Employee",
        reason: `HR Admin opened employee portal via impersonation token`,
      },
    });

    const url = `/employee/dashboard?impersonate=${token}`;

    return Response.json(apiSuccess({ token, url }, "Impersonation token created"));
  } catch {
    return apiError("SERVER_ERROR", "Failed to create impersonation token", 500);
  }
}
