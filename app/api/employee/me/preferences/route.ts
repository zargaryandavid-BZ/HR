import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

const preferencesSchema = z.object({
  tshirtSize: z.enum(T_SHIRT_SIZES).nullable().optional(),
  allergyInfo: z
    .string()
    .max(500, "Allergy information must be 500 characters or fewer")
    .nullable()
    .optional(),
});

/** Update the authenticated employee's t-shirt size and allergy preferences */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const tshirtSize =
      parsed.data.tshirtSize === undefined
        ? undefined
        : parsed.data.tshirtSize || null;

    const allergyInfo =
      parsed.data.allergyInfo === undefined
        ? undefined
        : parsed.data.allergyInfo?.trim() || null;

    const employee = await prisma.employee.update({
      where: { id: session.employeeId },
      data: {
        ...(tshirtSize !== undefined && { tShirtSize: tshirtSize }),
        ...(allergyInfo !== undefined && { allergies: allergyInfo }),
      },
      select: { tShirtSize: true, allergies: true },
    });

    return Response.json(
      apiSuccess({
        tshirtSize: employee.tShirtSize,
        allergyInfo: employee.allergies,
      })
    );
  } catch {
    return apiError("Server error", "Failed to update preferences", 500);
  }
}
