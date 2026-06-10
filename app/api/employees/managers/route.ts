import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Get list of managers for employee form dropdowns */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const managers = await prisma.user.findMany({
      where: { role: { in: ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"] } },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, departmentId: true },
        },
      },
    });

    return Response.json(
      apiSuccess(
        managers
          .filter((m) => m.employee)
          .map((m) => ({
            id: m.employee!.id,
            name: `${m.employee!.firstName} ${m.employee!.lastName}`,
            departmentId: m.employee!.departmentId,
          }))
      )
    );
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
