import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { leaveTypeSchema } from "@/lib/validations";

/** List all leave types */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER", "EMPLOYEE"]);

    const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });

    return Response.json(apiSuccess(leaveTypes));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create a new leave type */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = leaveTypeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const leaveType = await prisma.leaveType.create({ data: parsed.data });

    return Response.json(apiSuccess(leaveType, "Leave type created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create leave type", 500);
  }
}
