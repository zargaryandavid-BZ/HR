import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** List active positions for employee forms, optionally filtered by department */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;

    const positions = await prisma.position.findMany({
      where: {
        isActive: true,
        ...(departmentId && { departmentId }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return Response.json(apiSuccess(positions));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
