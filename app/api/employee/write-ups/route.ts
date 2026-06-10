import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { resolveUserNames } from "@/lib/individual-settings/documents";
import { getWriteUpAcknowledgedAt } from "@/lib/writeups/constants";

/** Returns write-ups for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const writeUps = await prisma.writeUp.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { number: "asc" },
    });

    const nameMap = await resolveUserNames(writeUps.map((w) => w.issuedBy));

    return Response.json(
      apiSuccess(
        writeUps.map((w) => {
          const acknowledgedAt = getWriteUpAcknowledgedAt(w);
          return {
            id: w.id,
            number: w.number,
            category: w.category,
            date: w.date.toISOString(),
            description: w.description,
            consequence: w.consequence,
            attachmentUrl: w.attachmentUrl,
            issuedBy: w.issuedBy,
            issuedByName: nameMap.get(w.issuedBy) ?? "Unknown",
            acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
            acknowledgedBy: w.acknowledgedBy,
            createdAt: w.createdAt.toISOString(),
          };
        })
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch write-ups", 500);
  }
}
