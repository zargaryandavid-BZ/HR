import { apiSuccess } from "@/lib/api-response";

/** Lightweight health check for dev server and deployment probes */
export async function GET() {
  return Response.json(
    apiSuccess({
      status: "ok",
      timestamp: new Date().toISOString(),
    })
  );
}
