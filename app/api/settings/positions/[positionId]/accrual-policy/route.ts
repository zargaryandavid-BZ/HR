import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { DEFAULT_ACCRUAL_POLICY } from "@/lib/accrual/constants";
import { ensureDefaultAccrualPolicy } from "@/lib/accrual";

type RouteParams = { params: Promise<{ positionId: string }> };

const accrualPolicySchema = z.object({
  hoursWorkedPerAccrual: z.number().positive().default(30),
  hoursEarnedPerAccrual: z.number().positive().default(1),
  ptoAccrualCapHours: z.number().positive().default(120),
  ptoRolloverCapHours: z.number().positive().default(40),
  sickAccrualCapHours: z.number().min(80).default(80),
  usableAfterDays: z.number().int().positive().default(90),
});

/** Returns the accrual policy for a position */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) return apiError("Not found", "Position not found", 404);

    const policy =
      (await prisma.accrualPolicy.findUnique({ where: { positionId } })) ??
      (await ensureDefaultAccrualPolicy(positionId));

    return Response.json(apiSuccess(policy));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create or update the accrual policy for a position */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;
    const body = await request.json();
    const parsed = accrualPolicySchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) return apiError("Not found", "Position not found", 404);

    const policy = await prisma.accrualPolicy.upsert({
      where: { positionId },
      create: { positionId, ...DEFAULT_ACCRUAL_POLICY, ...parsed.data },
      update: parsed.data,
    });

    return Response.json(apiSuccess(policy, "Accrual policy saved"));
  } catch {
    return apiError("Server error", "Failed to save accrual policy", 500);
  }
}
