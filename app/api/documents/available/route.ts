import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { serializeDocument } from "@/lib/documents/service";

/** List active repository documents not yet assigned to an employee */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const employeeId = request.nextUrl.searchParams.get("employeeId");
    if (!employeeId) {
      return apiError("Validation failed", "employeeId is required");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const assigned = await prisma.documentAssignment.findMany({
      where: { employeeId },
      select: { sopId: true },
    });
    const assignedIds = assigned.map((row) => row.sopId);

    const available = await prisma.sop.findMany({
      where: {
        id: { notIn: assignedIds },
        isActive: true,
        status: "ACTIVE",
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        documentType: true,
        scope: true,
        version: true,
        description: true,
        fileUrl: true,
        isActive: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        departmentIds: true,
        positionIds: true,
      },
    });

    return Response.json(
      apiSuccess(available.map((doc) => serializeDocument(doc)))
    );
  } catch (error) {
    console.error("List available documents error:", error);
    return apiError("Server error", "Failed to fetch available documents", 500);
  }
}
