import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { runYearEndRollover } from "@/lib/yearEndRollover";

/** Cron endpoint to run year-end PTO rollover and sick leave logging */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", "Invalid cron secret", 401);
    }

    const result = await runYearEndRollover();
    return Response.json(apiSuccess(result, "Year-end rollover completed"));
  } catch {
    return apiError("Server error", "Year-end rollover failed", 500);
  }
}
