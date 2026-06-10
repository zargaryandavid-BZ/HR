import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { acknowledgeEmployeeWriteUp } from "@/lib/writeups/acknowledge";

type RouteParams = { params: Promise<{ id: string }> };

/** Employee acknowledges their own write-up after client-side phrase confirmation */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id } = await params;

    const result = await acknowledgeEmployeeWriteUp(id, session.employeeId);

    return Response.json(apiSuccess(result));
  } catch (error) {
    console.error("Employee write-up acknowledge error:", error);
    if (error instanceof Error) {
      if (error.message === "Write-up not found") {
        return apiError("Not found", "Write-up not found", 404);
      }
      if (error.message === "Already acknowledged") {
        return apiError("Already acknowledged", "Already acknowledged", 400);
      }
    }
    return apiError("Server error", "Failed to acknowledge", 500);
  }
}
