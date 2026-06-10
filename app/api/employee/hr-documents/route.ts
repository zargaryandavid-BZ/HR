import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Returns generated HR documents (Offer Letter, Welcome Email) for the employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const docs = await prisma.generatedDocument.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { generatedAt: "desc" },
    });

    // Keep only the most recent document per type (newest-first order means first seen wins)
    const seen = new Set<string>();
    const latest = docs.filter((d) => {
      if (seen.has(d.type)) return false;
      seen.add(d.type);
      return true;
    });

    return Response.json(
      apiSuccess(
        latest.map((d) => ({
          id: d.id,
          type: d.type,
          fileUrl: d.fileUrl,
          generatedAt: d.generatedAt.toISOString(),
        }))
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch HR documents", 500);
  }
}
