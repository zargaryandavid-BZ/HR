import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { departmentSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

/** Update a department */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = departmentSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const department = await prisma.department.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json(apiSuccess(department, "Department updated"));
  } catch {
    return apiError("Server error", "Failed to update department", 500);
  }
}

/** Delete a department */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const employeeCount = await prisma.employee.count({ where: { departmentId: id } });
    if (employeeCount > 0) {
      return apiError("Conflict", "Cannot delete department with assigned employees");
    }

    await prisma.department.delete({ where: { id } });

    return Response.json(apiSuccess(null, "Department deleted"));
  } catch {
    return apiError("Server error", "Failed to delete department", 500);
  }
}
