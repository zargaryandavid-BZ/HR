import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { holidaySchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

/** Update a holiday */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = holidaySchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        name: parsed.data.name,
        date: new Date(parsed.data.date),
        isPaid: parsed.data.isPaid,
        isRecurringAnnually: parsed.data.isRecurringAnnually,
      },
    });

    return Response.json(apiSuccess(holiday, "Holiday updated"));
  } catch {
    return apiError("Server error", "Failed to update holiday", 500);
  }
}

/** Delete a holiday */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    await prisma.holiday.delete({ where: { id } });

    return Response.json(apiSuccess(null, "Holiday deleted"));
  } catch {
    return apiError("Server error", "Failed to delete holiday", 500);
  }
}
