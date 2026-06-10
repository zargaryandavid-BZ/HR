import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { leaveTypeSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

/** Update a leave type */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = leaveTypeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json(apiSuccess(leaveType, "Leave type updated"));
  } catch {
    return apiError("Server error", "Failed to update leave type", 500);
  }
}

/** Delete a leave type */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    await prisma.leaveType.delete({ where: { id } });

    return Response.json(apiSuccess(null, "Leave type deleted"));
  } catch {
    return apiError("Server error", "Failed to delete leave type", 500);
  }
}
