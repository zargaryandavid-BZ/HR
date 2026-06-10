import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Return the current authenticated user profile */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError("Unauthorized", "Not authenticated", 401);
  }

  return Response.json(
    apiSuccess({
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role,
      employeeId: session.employeeId,
      departmentId: session.employee?.departmentId ?? null,
      mustChangePassword: session.mustChangePassword,
    })
  );
}
