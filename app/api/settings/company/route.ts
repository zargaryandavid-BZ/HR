import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { companySettingsSchema } from "@/lib/validations";

/** Get company settings (creates default row if missing) */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    let settings = await prisma.companySettings.findUnique({ where: { id: "default" } });

    if (!settings) {
      settings = await prisma.companySettings.create({ data: { id: "default" } });
    }

    return Response.json(apiSuccess(settings));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Update company settings */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = companySettingsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const settings = await prisma.companySettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...parsed.data, updatedById: session.id },
      update: { ...parsed.data, updatedById: session.id },
    });

    return Response.json(apiSuccess(settings, "Settings updated"));
  } catch {
    return apiError("Server error", "Failed to update settings", 500);
  }
}
