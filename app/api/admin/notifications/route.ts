import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, getPaginationParams } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { formatEmployeeName } from "@/lib/utils";

/** Returns all employee notifications for HR admin review */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const employeeId = searchParams.get("employeeId") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const isReadParam = searchParams.get("isRead");

    const where = {
      channel: "IN_APP" as const,
      ...(employeeId ? { employeeId } : {}),
      ...(type ? { eventType: type } : {}),
      ...(isReadParam === "true"
        ? { status: "READ" as const }
        : isReadParam === "false"
          ? { status: { not: "READ" as const } }
          : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return Response.json(
      apiSuccess({
        notifications: notifications.map((n) => {
          const snapshot = n.contentSnapshot as { message?: string; title?: string } | null;
          return {
            id: n.id,
            employeeId: n.employeeId,
            employeeName: formatEmployeeName(
              n.employee.firstName,
              n.employee.lastName,
              n.employee.preferredName
            ),
            type: n.eventType,
            title: snapshot?.title ?? n.eventType.replace(/_/g, " "),
            message: snapshot?.message ?? "",
            isRead: n.status === "READ",
            createdAt: n.createdAt.toISOString(),
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch notifications", 500);
  }
}
