import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { locationZoneSchema } from "@/lib/validations";

/** List all location zones */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const zones = await prisma.locationZone.findMany({ orderBy: { name: "asc" } });

    return Response.json(apiSuccess(zones));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Create a new geofence location zone */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const existingCount = await prisma.locationZone.count();
    if (existingCount >= 5) {
      return apiError("Validation failed", "You can add up to 5 office locations.", 400);
    }

    const body = await request.json();
    const parsed = locationZoneSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const zone = await prisma.locationZone.create({ data: parsed.data });

    return Response.json(apiSuccess(zone, "Location zone created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create location zone", 500);
  }
}
