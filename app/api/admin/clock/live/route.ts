import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { detectAndFlagMissedClockOuts } from "@/lib/time/missed-clockout";

export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);

    detectAndFlagMissedClockOuts().catch(console.error);

    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        timeEntries: {
          where: { clockOut: null, status: { in: ["IN_PROGRESS", "ON_BREAK"] } },
          take: 1,
          include: { breaks: { where: { endedAt: null } } },
        },
      },
      orderBy: [{ firstName: "asc" }],
    });

    const live = employees.map((emp) => {
      const entry = emp.timeEntries[0] ?? null;
      const openBreak = entry?.breaks[0] ?? null;
      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name ?? null,
        position: emp.position?.name ?? null,
        isClockedIn: !!entry,
        isOnBreak: entry?.status === "ON_BREAK",
        clockIn: entry?.clockIn ?? null,
        breakStartedAt: openBreak?.startedAt ?? null,
        elapsed: entry ? Math.floor((Date.now() - entry.clockIn.getTime()) / 1000) : 0,
        breakElapsed: openBreak
          ? Math.floor((Date.now() - openBreak.startedAt.getTime()) / 1000)
          : 0,
      };
    });

    return Response.json(apiSuccess(live));
  } catch {
    return apiError("Server error", "Failed to fetch live clock data", 500);
  }
}
