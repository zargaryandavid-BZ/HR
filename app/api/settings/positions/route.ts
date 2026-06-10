import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { positionSchema } from "@/lib/validations";
import { ensureDefaultAccrualPolicy } from "@/lib/accrual";

/** List positions, optionally filtered by department */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);

    const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const positions = await prisma.position.findMany({
      where: {
        ...(departmentId && { departmentId }),
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
        onboardingTemplates: {
          where: { isActive: true },
          select: { id: true, name: true, _count: { select: { steps: true } } },
          take: 1,
        },
        offboardingTemplate: {
          select: { id: true, name: true, _count: { select: { steps: true } } },
        },
      },
    });

    return Response.json(apiSuccess(positions));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create a new position */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = positionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const position = await prisma.position.create({
      data: parsed.data,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
        onboardingTemplates: {
          where: { isActive: true },
          select: { id: true },
          take: 1,
        },
        offboardingTemplate: { select: { id: true } },
      },
    });

    await ensureDefaultAccrualPolicy(position.id);

    return Response.json(apiSuccess(position, "Position created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create position", 500);
  }
}
