import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { convertOfferToEmployee } from "@/lib/offers/convert";

const convertSchema = z.object({
  workEmail: z.string().email("Valid work email required"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
  scheduleType: z.enum(["FIXED", "SHIFT_BASED", "HOURS_BASED", "FLEXIBLE"]),
  scheduleConfig: z.record(z.unknown()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const body = await request.json();
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const employee = await convertOfferToEmployee({
      offerId: id,
      workEmail: parsed.data.workEmail,
      employmentType: parsed.data.employmentType,
      scheduleType: parsed.data.scheduleType,
      scheduleConfig: parsed.data.scheduleConfig as Parameters<typeof convertOfferToEmployee>[0]["scheduleConfig"],
      assignedByUserId: session.id,
    });

    return Response.json(
      apiSuccess({ employeeId: employee.id }, "Employee account created successfully"),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(
        "Conversion failed",
        "Work email is already in use. Please choose a different work email.",
        409
      );
    }
    const msg = error instanceof Error ? error.message : "Conversion failed";
    if (typeof msg === "string" && msg.toLowerCase().includes("already in use")) {
      return apiError("Conversion failed", msg, 409);
    }
    return apiError("Conversion failed", msg, 500);
  }
}
