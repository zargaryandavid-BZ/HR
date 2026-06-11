import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * POST /api/admin/time-entries/merge
 *
 * Finds all employees who have more than one TimeEntry on the same calendar day
 * (UTC date), then merges each group into the earliest entry:
 *  - The time gaps between consecutive clock-out / clock-in are recorded as REST breaks
 *  - All BreakEntry rows from duplicate entries are re-parented to the canonical entry
 *  - hoursWorked is recalculated as (wall-clock span) minus (all completed break minutes)
 *  - Duplicate TimeEntry rows are deleted
 */
export async function POST() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    // Load every entry with its breaks so we can work in memory
    const allEntries = await prisma.timeEntry.findMany({
      include: { breaks: true },
      orderBy: [{ employeeId: "asc" }, { clockIn: "asc" }],
    });

    // Group by employeeId + UTC calendar date (YYYY-MM-DD)
    const groups = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      const day = entry.clockIn.toISOString().slice(0, 10);
      const key = `${entry.employeeId}|${day}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    let mergedGroups = 0;
    let deletedEntries = 0;

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      // Already sorted by clockIn asc from the query
      const [canonical, ...duplicates] = group;
      let currentCanonicalClockOut = canonical.clockOut;

      await prisma.$transaction(async (tx) => {
        for (const dup of duplicates) {
          // Record the gap between the previous clockOut and this clockIn as a REST break
          if (currentCanonicalClockOut && dup.clockIn > currentCanonicalClockOut) {
            const gapMin =
              (dup.clockIn.getTime() - currentCanonicalClockOut.getTime()) / 60_000;
            await tx.breakEntry.create({
              data: {
                timeEntryId: canonical.id,
                breakType: "REST",
                startedAt: currentCanonicalClockOut,
                endedAt: dup.clockIn,
                durationMin: gapMin,
              },
            });
          }

          // Re-parent all breaks from the duplicate to the canonical entry
          if (dup.breaks.length > 0) {
            await tx.breakEntry.updateMany({
              where: { timeEntryId: dup.id },
              data: { timeEntryId: canonical.id },
            });
          }

          // Advance the running clockOut to the duplicate's clockOut (if later)
          if (dup.clockOut) {
            if (!currentCanonicalClockOut || dup.clockOut > currentCanonicalClockOut) {
              currentCanonicalClockOut = dup.clockOut;
            }
          } else {
            // Duplicate is still open — canonical becomes open too
            currentCanonicalClockOut = null;
          }

          // Delete the duplicate
          await tx.timeEntry.delete({ where: { id: dup.id } });
          deletedEntries++;
        }

        // Reload all breaks now that they're consolidated
        const consolidatedBreaks = await tx.breakEntry.findMany({
          where: { timeEntryId: canonical.id },
        });

        // Recalculate hoursWorked
        const totalBreakMs = consolidatedBreaks
          .filter((b) => b.endedAt)
          .reduce((sum, b) => sum + (b.durationMin ?? 0) * 60_000, 0);

        const hoursWorked =
          currentCanonicalClockOut
            ? Math.max(
                0,
                (currentCanonicalClockOut.getTime() - canonical.clockIn.getTime() - totalBreakMs) /
                  3_600_000
              )
            : null;

        const newStatus = currentCanonicalClockOut
          ? canonical.status === "APPROVED"
            ? "APPROVED"
            : "COMPLETED"
          : "IN_PROGRESS";

        await tx.timeEntry.update({
          where: { id: canonical.id },
          data: {
            clockOut: currentCanonicalClockOut,
            hoursWorked,
            status: newStatus,
          },
        });
      });

      mergedGroups++;
    }

    return Response.json(
      apiSuccess(
        { mergedGroups, deletedEntries },
        deletedEntries === 0
          ? "No duplicate entries found"
          : `Merged ${deletedEntries} duplicate entries across ${mergedGroups} days`
      )
    );
  } catch {
    return apiError("Server error", "Failed to merge entries", 500);
  }
}
