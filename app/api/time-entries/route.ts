import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { recordTimeEntry } from "@/lib/time/record-time-entry";

const schema = z.object({
  employeeId: z.string().min(1),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  timestamp: z.string().datetime().optional(),
  source: z.enum([
    "QR_KIOSK",
    "MOBILE_IN_ZONE",
    "MOBILE_OFFSITE",
    "MANUAL_HR",
    "MANUAL_MANAGER",
  ]),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationZoneId: z.string().optional(),
});

/** Record a clock-in or clock-out and trigger accrual on clock-out */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "HR_ADMIN", "MANAGER"]);
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const entry = await recordTimeEntry({
      employeeId: parsed.data.employeeId,
      eventType: parsed.data.eventType,
      timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
      source: parsed.data.source,
      locationLat: parsed.data.locationLat,
      locationLng: parsed.data.locationLng,
      locationZoneId: parsed.data.locationZoneId,
    });

    return Response.json(
      apiSuccess(
        {
          id: entry.id,
          eventType: entry.eventType,
          timestamp: entry.timestamp.toISOString(),
        },
        "Time entry recorded"
      )
    );
  } catch {
    return apiError("Server error", "Failed to record time entry", 500);
  }
}
