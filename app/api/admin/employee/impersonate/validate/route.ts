import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * Internal route called by middleware to validate an impersonation token.
 * Returns employeeId + phone so middleware can sign an employee session JWT.
 * This route is excluded from auth middleware via the matcher config.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = (await request.json()) as { token?: string };

    if (!token) {
      return apiError("BAD_REQUEST", "Token required", 400);
    }

    const record = await prisma.employeeImpersonationToken.findUnique({
      where: { token },
      include: {
        employee: { select: { id: true, phone: true, status: true } },
      },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return apiError("UNAUTHORIZED", "Invalid or expired impersonation token", 401);
    }

    if (record.employee.status !== "ACTIVE") {
      return apiError("FORBIDDEN", "Employee account is inactive", 403);
    }

    // Mark token as used — single-use only
    await prisma.employeeImpersonationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return Response.json(
      apiSuccess(
        { employeeId: record.employeeId, phone: record.employee.phone ?? "" },
        "Token valid"
      )
    );
  } catch {
    return apiError("SERVER_ERROR", "Failed to validate token", 500);
  }
}
