import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { locationZoneSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

/** Update a location zone */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = locationZoneSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const zone = await prisma.locationZone.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json(apiSuccess(zone, "Location zone updated"));
  } catch {
    return apiError("Server error", "Failed to update location zone", 500);
  }
}

/** Delete a location zone */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    await prisma.locationZone.delete({ where: { id } });

    return Response.json(apiSuccess(null, "Location zone deleted"));
  } catch {
    return apiError("Server error", "Failed to delete location zone", 500);
  }
}
