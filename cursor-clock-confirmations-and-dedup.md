# Cursor Prompt — Clock Confirmation Dialogs + Same-Day Re-Clock Logic

## What to build

Two independent changes:

1. **Confirmation step** before every clock action (clock in, clock out, start break, end break)
2. **Same-day re-clock = automatic break** — if an employee clocks out and then clocks back in on the same calendar day, do NOT create a second `TimeEntry`. Re-open the existing one and record the gap as a break automatically.

---

## Change 1 — Confirmation dialogs in `components/employee-portal/employee-clock-widget.tsx`

### What to add

Add a `confirm` state that holds a pending action. When an action button is clicked the first time, set `confirm` (show the confirmation UI). When the user confirms, execute the action. Cancel clears `confirm`.

```tsx
type PendingConfirm = {
  label: string;        // e.g. "Clock Out"
  description: string;  // e.g. "Are you sure you want to clock out?"
  onConfirm: () => void;
};

const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
```

### Where to render it

Render an inline confirmation card **above the main widget card** when `confirm` is not null:

```tsx
{confirm && (
  <Card className="mb-2 border-orange-200 bg-orange-50">
    <CardContent className="py-3 flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-orange-800">{confirm.description}</p>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => setConfirm(null)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => { confirm.onConfirm(); setConfirm(null); }}
        >
          {confirm.label}
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

### How each button triggers confirm (replace direct calls)

**Clock In button:**
```tsx
onClick={() =>
  setConfirm({
    label: "Clock In",
    description: "Confirm clock in?",
    onConfirm: clockIn,
  })
}
```

**Clock Out button:**
```tsx
onClick={() =>
  setConfirm({
    label: "Clock Out",
    description: "Are you sure you want to clock out?",
    onConfirm: clockOut,
  })
}
```

**Start Rest Break button:**
```tsx
onClick={() =>
  setConfirm({
    label: "Start Rest Break",
    description: "Start a rest break?",
    onConfirm: () => startBreak("REST"),
  })
}
```

**Start Meal Break button:**
```tsx
onClick={() =>
  setConfirm({
    label: "Start Meal Break",
    description: "Start a meal break?",
    onConfirm: () => startBreak("MEAL"),
  })
}
```

**End Break button:**
```tsx
onClick={() =>
  setConfirm({
    label: "End Break",
    description: "End your break and resume work?",
    onConfirm: endBreak,
  })
}
```

Remove `disabled={loading === "break-end"}` from the End Break button and replace with `disabled={!!loading || !!confirm}` on all action buttons, so buttons are locked while a confirmation is pending.

---

## Change 2 — Same-day re-clock = automatic break in `app/api/clock/in/route.ts`

### Current behavior (wrong)
The route currently returns 409 if there is already an open entry. But it does nothing when the employee was previously clocked out for the day — it creates a brand new `TimeEntry`, resulting in two entries for the same day.

### New behavior

When `POST /api/clock/in` is called:

1. Check for an **open** entry (status IN_PROGRESS or ON_BREAK, clockOut = null) → still return 409 "already clocked in"
2. Check for a **completed** `TimeEntry` from **today** (same calendar date as now in local time, or UTC date match is fine)
3. If a today-entry exists and is COMPLETED → **re-open it**, record the gap as a REST break
4. If no entry at all → create a new one (existing logic)

### Replacement for `app/api/clock/in/route.ts`

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfDay, endOfDay } from "date-fns";

export async function POST(_req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const now = new Date();

    // 1. Already clocked in — reject
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
    });
    if (openEntry) {
      return apiError("Already clocked in", "You are already clocked in", 409);
    }

    // 2. Completed entry from today — re-open it, record gap as a break
    const todayEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        status: "COMPLETED",
        clockIn: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
      orderBy: { clockIn: "desc" },
    });

    if (todayEntry && todayEntry.clockOut) {
      const gapMinutes = (now.getTime() - todayEntry.clockOut.getTime()) / 60000;

      const updated = await prisma.$transaction(async (tx) => {
        // Record the gap between clock-out and now as an automatic REST break
        await tx.breakEntry.create({
          data: {
            timeEntryId: todayEntry.id,
            breakType: "REST",
            startedAt: todayEntry.clockOut!,
            endedAt: now,
            durationMin: gapMinutes,
          },
        });

        // Re-open the entry
        return tx.timeEntry.update({
          where: { id: todayEntry.id },
          data: {
            clockOut: null,
            hoursWorked: null,
            status: "IN_PROGRESS",
          },
        });
      });

      return Response.json(
        apiSuccess(
          { id: updated.id, clockIn: updated.clockIn, resumedShift: true },
          "Shift resumed — break recorded automatically"
        )
      );
    }

    // 3. No entry today — create fresh
    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: session.employeeId,
        clockIn: now,
        status: "IN_PROGRESS",
        clockInMethod: "PORTAL",
      },
    });

    return Response.json(apiSuccess({ id: entry.id, clockIn: entry.clockIn }, "Clocked in"));
  } catch {
    return apiError("Server error", "Failed to clock in", 500);
  }
}
```

---

## Change 3 — Fix `hoursWorked` calculation in `app/api/clock/out/route.ts`

With same-day re-clocks, `clockIn` is the original start of the day. `clockOut - clockIn` now includes break time. Subtract total break minutes from the elapsed wall-clock time.

Find this section in the clock-out route:
```ts
const hoursWorked = calculateHours(entry.clockIn, clockOut);
```

Replace with:
```ts
import { startOfDay, endOfDay } from "date-fns";

// Sum all completed breaks (including the auto-gap breaks from re-clocks)
const totalBreakMs = entry.breaks
  .filter((b) => b.endedAt)
  .reduce((sum, b) => {
    const dur = (b.durationMin ?? 0) * 60 * 1000;
    return sum + dur;
  }, 0);

const rawMs = clockOut.getTime() - entry.clockIn.getTime();
const hoursWorked = Math.max(0, (rawMs - totalBreakMs) / 3_600_000);
```

---

## Change 4 — Timesheet: group same-day entries per employee

In `components/timesheet/admin-live-board.tsx`, the time entries table currently shows one row per `TimeEntry`. Because same-day re-clocks now reuse the same `TimeEntry`, this is already handled at the data layer — there will only be one `TimeEntry` per person per day.

However, add a `Breaks` column to the time entries table so admins can see the break count:

In the `<thead>` row, add after the Hours column:
```tsx
<th className="px-4 py-2 font-medium">Breaks</th>
```

The API already returns the `breaks` array on each entry (the list endpoint includes it). Add to the row:
```tsx
<td className="px-4 py-2 text-sm text-muted-foreground">
  {entry.breaks?.length ?? 0}
</td>
```

Also update the TypeScript type at the top of the file — add `breaks` to `TimeEntryRow`:
```ts
type TimeEntryRow = {
  // ... existing fields
  breaks?: Array<{ id: string; breakType: string; durationMin: number | null }>;
};
```

---

## Summary of files to change

| File | Change |
|------|--------|
| `components/employee-portal/employee-clock-widget.tsx` | Add `confirm` state, inline confirmation card, wire all buttons through confirm |
| `app/api/clock/in/route.ts` | Replace with same-day re-clock logic (gap → auto REST break, re-open entry) |
| `app/api/clock/out/route.ts` | Fix `hoursWorked` to subtract total break time |
| `components/timesheet/admin-live-board.tsx` | Add `breaks` column to time entries table |

No schema changes required.
No other files need to change.

## Conventions

- `date-fns` is already installed — use `startOfDay`, `endOfDay` for day boundary queries
- `prisma.$transaction(async (tx) => { ... })` for atomic multi-step writes
- `apiSuccess()` / `apiError()` from `@/lib/api-response` for all API responses
- `getEmployeeSession()` from `@/lib/employee-session` for employee portal auth
