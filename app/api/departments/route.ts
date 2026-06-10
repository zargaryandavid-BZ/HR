import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { departmentSchema } from "@/lib/validations";

/** List all departments */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true, positions: true } } },
    });

    return Response.json(apiSuccess(departments));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create a new department */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = departmentSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const department = await prisma.department.create({ data: parsed.data });

    return Response.json(apiSuccess(department, "Department created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create department", 500);
  }
}
