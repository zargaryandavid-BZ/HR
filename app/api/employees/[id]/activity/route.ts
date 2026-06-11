import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

const ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_CREATED: "Employee created",
  EMPLOYEE_UPDATED: "Profile updated",
  EMPLOYEE_DEACTIVATED: "Employee deactivated",
  EMPLOYEE_REACTIVATED: "Employee reactivated",
  EMPLOYEE_PORTAL_ACCESSED: "Employee portal opened",
  ONBOARDING_DOCS_SENT: "Onboarding docs sent",
  DOCUMENT_APPROVED: "Document approved",
  DOCUMENT_SIGNED: "Document signed",
  TIME_ENTRY_EDITED: "Time entry edited",
  TIME_ENTRY_APPROVED: "Time entry approved",
  TIME_ENTRY_CREATED: "Time entry created",
  LEAVE_APPROVED: "Leave request approved",
  LEAVE_REJECTED: "Leave request rejected",
  LEAVE_BALANCE_ADJUSTED: "Leave balance adjusted",
  WRITE_UP_CREATED: "Write-up created",
  WRITE_UP_UPDATED: "Write-up updated",
  COMPENSATION_UPDATED: "Compensation updated",
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const { id } = await params;

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "25"), 50);

    const logs = await prisma.auditLog.findMany({
      where: { targetId: id, targetTable: "Employee" },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    const items = logs.slice(0, limit).map((log) => ({
      id: log.id,
      action: log.action,
      label: ACTION_LABELS[log.action] ?? log.action.replace(/_/g, " "),
      performedBy: log.user.name ?? log.user.email,
      reason: log.reason ?? null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt,
    }));

    return Response.json(
      apiSuccess({ items, nextCursor: hasMore ? items[items.length - 1]?.id : null })
    );
  } catch (err) {
    return apiError("Failed to load activity", String(err), 500);
  }
}
