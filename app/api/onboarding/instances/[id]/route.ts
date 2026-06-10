import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string }> };

/** Get onboarding instance details */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const { id } = await params;

    const instance = await prisma.onboardingInstance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            workEmail: true,
            phone: true,
            department: true,
            position: true,
          },
        },
        template: {
          include: {
            position: { include: { department: true } },
            steps: { orderBy: { sortOrder: "asc" } },
            _count: { select: { steps: true } },
          },
        },
        stepProgress: {
          include: { step: true },
          orderBy: { step: { sortOrder: "asc" } },
        },
        triggeredBy: { select: { id: true, name: true, email: true } },
        reminders: { orderBy: { sentAt: "desc" }, take: 5 },
      },
    });

    if (!instance) {
      return apiError("Not found", "Onboarding instance not found", 404);
    }

    const isHr = ["HR_ADMIN", "SUPER_ADMIN"].includes(session.role);
    const isOwner = session.employeeId === instance.employeeId;

    if (!isHr && !isOwner) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    return Response.json(apiSuccess(instance));
  } catch {
    return apiError("Server error", "Failed to fetch onboarding instance", 500);
  }
}
