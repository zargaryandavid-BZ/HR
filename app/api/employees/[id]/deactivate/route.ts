import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { initiateOffboarding } from "@/lib/offboarding/assignments";

type RouteParams = { params: Promise<{ id: string }> };

/** Soft-deactivate an employee and silently start offboarding */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      await initiateOffboarding(id, session.id, tx);
      return updated;
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "DEACTIVATE_EMPLOYEE",
        targetId: id,
        targetTable: "Employee",
        reason: "Employee deactivated by HR Admin",
      },
    });

    return Response.json(apiSuccess(employee, "Employee deactivated successfully"));
  } catch {
    return apiError("Server error", "Failed to deactivate employee", 500);
  }
}
