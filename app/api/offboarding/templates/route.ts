import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** List all active offboarding templates */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const templates = await prisma.offboardingTemplate.findMany({
      where: { isActive: true },
      include: {
        position: { include: { department: { select: { id: true, name: true } } } },
        _count: { select: { steps: true } },
      },
      orderBy: [{ position: { department: { name: "asc" } } }, { name: "asc" }],
    });

    return Response.json(apiSuccess(templates));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
