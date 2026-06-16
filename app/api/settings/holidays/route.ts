import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseFormDate, toDateOnlyString } from "@/lib/dates";
import { holidaySchema } from "@/lib/validations";

/** List company-wide holidays */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER", "EMPLOYEE"]);

    const holidays = await prisma.holiday.findMany({
      where: { isCompanyWide: true },
      orderBy: { date: "asc" },
    });

    return Response.json(
      apiSuccess(
        holidays.map((holiday) => ({
          ...holiday,
          date: toDateOnlyString(holiday.date),
        }))
      )
    );
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create a company holiday */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = holidaySchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: parsed.data.name,
        date: parseFormDate(parsed.data.date),
        isPaid: parsed.data.isPaid,
        isRecurringAnnually: parsed.data.isRecurringAnnually,
        isCompanyWide: true,
      },
    });

    return Response.json(
      apiSuccess(
        { ...holiday, date: toDateOnlyString(holiday.date) },
        "Holiday created"
      ),
      { status: 201 }
    );
  } catch {
    return apiError("Server error", "Failed to create holiday", 500);
  }
}
