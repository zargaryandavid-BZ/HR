import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { manualAdjustBalance } from "@/lib/accrual";

type RouteParams = { params: Promise<{ id: string }> };

const adjustSchema = z.object({
  leaveTypeId: z.string().min(1),
  hours: z.number().positive(),
  type: z.enum(["ADD", "DEDUCT"]),
  note: z.string().min(1, "Reason is required"),
});

/** Manually add or deduct accrued leave hours for an employee */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = adjustSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const result = await manualAdjustBalance({
      employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      hours: parsed.data.hours,
      type: parsed.data.type,
      note: parsed.data.note,
      adjustedById: session.id,
    });

    return Response.json(
      apiSuccess({ newBalanceHours: result.newBalance }, "Balance adjusted")
    );
  } catch {
    return apiError("Server error", "Failed to adjust balance", 500);
  }
}
