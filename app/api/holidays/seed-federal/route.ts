import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { generateFederalHolidaysForYear } from "@/lib/utils/federal-holidays";

const seedSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

/** Seed US federal holidays for a given year */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "HR_ADMIN"]);

    const body = await request.json();
    const parsed = seedSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid year");
    }

    const { year } = parsed.data;
    const holidays = generateFederalHolidaysForYear(year);

    const result = await prisma.holiday.createMany({
      data: holidays,
      skipDuplicates: true,
    });

    return Response.json(
      apiSuccess({ created: result.count }, `Seeded ${result.count} holidays for ${year}`)
    );
  } catch {
    return apiError("Server error", "Failed to seed federal holidays", 500);
  }
}
