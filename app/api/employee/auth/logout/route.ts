import { buildLogoutCookieHeader } from "@/lib/employee-session";
import { apiSuccess } from "@/lib/api-response";

/** Clear the employee session cookie */
export async function POST() {
  const response = Response.json(apiSuccess(null, "Logged out"));
  response.headers.set("Set-Cookie", buildLogoutCookieHeader());
  return response;
}
