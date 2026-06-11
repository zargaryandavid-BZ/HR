import { detectAndFlagMissedClockOuts } from "@/lib/time/missed-clockout";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const count = await detectAndFlagMissedClockOuts();
    return Response.json(apiSuccess({ flagged: count }));
  } catch {
    return apiError("Server error", "Cron failed", 500);
  }
}
