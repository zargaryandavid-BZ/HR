# Cursor AI — Clock-In / Clock-Out Implementation Prompt

Paste this entire file into Cursor's chat (Agent mode). It is self-contained.

---

## Project Context

This is **Bazaar Printing HR Platform** — a Next.js 15 App Router app with:
- TypeScript strict mode, Tailwind CSS, shadcn/ui-style components
- Supabase Auth + PostgreSQL, Prisma ORM
- RBAC: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`
- Employee portal uses a separate JWT cookie (`employee_session`, 30-day) — NOT Supabase auth
- `getEmployeeSession()` from `lib/employee-session.ts` returns `{ employeeId, phone }`
- `requireRole([...])` from `lib/auth.ts` protects admin API routes
- API responses use `apiSuccess()` / `apiError()` from `lib/api-response.ts`
- Run schema changes with `npm run db:push` (NOT `npx prisma db push`)

---

## What Already Exists (do not duplicate)

- `TimeEntry` model in `prisma/schema.prisma` — **old event-log style** (one row per CLOCK_IN or CLOCK_OUT event). This needs to be **replaced** with a session-based model below.
- `lib/time/hours-worked.ts` — rewrite to support new model
- `lib/time/record-time-entry.ts` — superseded by new API routes; can be deleted
- `lib/time/accrual-trigger.ts` — **keep as-is**, still needed
- `lib/time/overtime.ts` — **keep as-is**, still needed
- `app/api/time-entries/route.ts` — superseded; can be deleted or kept for backwards compat
- `/app/(dashboard)/admin/timesheet/page.tsx` — currently shows `AdminTimesheetPlaceholder`. Replace content.
- `/components/timesheet/admin-timesheet-placeholder.tsx` — will be replaced
- `/components/employee-portal/employee-dashboard.tsx` — add clock widget at top of `<main>`
- Each `Employee` has a `qrCodeToken` field. QR encodes the token string directly.
- `lib/breaks/` — break **schedule config** (not clock tracking). Leave untouched.

---

## Step 1 — Schema Changes

### Remove from `prisma/schema.prisma`

Delete these enums (they conflict with new ones):
```
enum TimeEventType { CLOCK_IN, CLOCK_OUT }
enum TimeEntrySource { QR_KIOSK, MOBILE_IN_ZONE, MOBILE_OFFSITE, MANUAL_HR, MANUAL_MANAGER }
```

Delete the old `TimeEntry` model entirely.

### Add to `prisma/schema.prisma`

```prisma
enum TimeEntryStatus {
  IN_PROGRESS
  ON_BREAK
  COMPLETED
  APPROVED
  FLAGGED
}

enum ClockMethod {
  PORTAL
  QR_SCAN
  MANUAL
}

enum BreakType {
  REST
  MEAL
}

model TimeEntry {
  id             String          @id @default(cuid())
  employeeId     String
  employee       Employee        @relation(fields: [employeeId], references: [id])
  clockIn        DateTime
  clockOut       DateTime?
  hoursWorked    Float?
  status         TimeEntryStatus @default(IN_PROGRESS)
  clockInMethod  ClockMethod     @default(PORTAL)
  clockOutMethod ClockMethod?
  breaks         BreakEntry[]
  date           DateTime        @default(dbgenerated("now()"))
  notes          String?
  approvedById   String?
  approvedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([employeeId, clockIn])
  @@index([status])
}

model BreakEntry {
  id          String     @id @default(cuid())
  timeEntryId String
  timeEntry   TimeEntry  @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
  breakType   BreakType
  startedAt   DateTime
  endedAt     DateTime?
  durationMin Float?
  createdAt   DateTime   @default(now())

  @@index([timeEntryId])
}
```

Also update the `Employee` model — replace the old `timeEntries TimeEntry[]` relation line with:
```prisma
timeEntries TimeEntry[]
```
(same name, the relation will resolve to the new model automatically after the old one is removed)

After making schema changes, run:
```bash
npm run db:push
```

---

## Step 2 — Rewrite `lib/time/hours-worked.ts`

```typescript
/** Calculate total hours worked for a session-based TimeEntry */
export function calculateHours(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

/** Calculate elapsed seconds from a start time to now */
export function elapsedSeconds(from: Date): number {
  return Math.floor((Date.now() - from.getTime()) / 1000);
}

/** Format seconds as HH:MM:SS */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
```

---

## Step 3 — API Routes

Create each file below. All employee-facing routes authenticate with `getEmployeeSession()`. All admin routes authenticate with `requireRole(["HR_ADMIN", "SUPER_ADMIN"])`.

### `app/api/clock/in/route.ts`
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    // Check not already clocked in
    const existing = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
    });
    if (existing) return apiError("Already clocked in", "You are already clocked in", 409);

    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: session.employeeId,
        clockIn: new Date(),
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

### `app/api/clock/out/route.ts`
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateHours } from "@/lib/time/hours-worked";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

export async function POST(_req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const entry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
      include: { breaks: true },
    });
    if (!entry) return apiError("Not clocked in", "No active shift found", 404);

    // Close any open break
    const openBreak = entry.breaks.find((b) => !b.endedAt);
    if (openBreak) {
      const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
      await prisma.breakEntry.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date(), durationMin },
      });
    }

    const clockOut = new Date();
    const hoursWorked = calculateHours(entry.clockIn, clockOut);

    const updated = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { clockOut, hoursWorked, status: "COMPLETED", clockOutMethod: "PORTAL" },
      include: { breaks: true },
    });

    await triggerAccrualForHoursWorked(session.employeeId, hoursWorked);

    const totalBreakMin = updated.breaks
      .filter((b) => b.endedAt)
      .reduce((sum, b) => sum + (b.durationMin ?? 0), 0);

    return Response.json(
      apiSuccess({ hoursWorked, totalBreakMin, entry: updated }, "Clocked out")
    );
  } catch {
    return apiError("Server error", "Failed to clock out", 500);
  }
}
```

### `app/api/clock/break/start/route.ts`
```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.object({ breakType: z.enum(["REST", "MEAL"]) });

export async function POST(req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "Invalid break type");

    const entry = await prisma.timeEntry.findFirst({
      where: { employeeId: session.employeeId, clockOut: null, status: "IN_PROGRESS" },
    });
    if (!entry) return apiError("Not clocked in", "No active shift", 404);

    const [breakEntry] = await prisma.$transaction([
      prisma.breakEntry.create({
        data: { timeEntryId: entry.id, breakType: parsed.data.breakType, startedAt: new Date() },
      }),
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "ON_BREAK" } }),
    ]);

    return Response.json(apiSuccess({ id: breakEntry.id }, "Break started"));
  } catch {
    return apiError("Server error", "Failed to start break", 500);
  }
}
```

### `app/api/clock/break/end/route.ts`
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const entry = await prisma.timeEntry.findFirst({
      where: { employeeId: session.employeeId, clockOut: null, status: "ON_BREAK" },
      include: { breaks: { where: { endedAt: null } } },
    });
    if (!entry || entry.breaks.length === 0)
      return apiError("Not on break", "No active break found", 404);

    const openBreak = entry.breaks[0];
    const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;

    await prisma.$transaction([
      prisma.breakEntry.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date(), durationMin },
      }),
      prisma.timeEntry.update({ where: { id: entry.id }, data: { status: "IN_PROGRESS" } }),
    ]);

    return Response.json(apiSuccess({ durationMin }, "Break ended"));
  } catch {
    return apiError("Server error", "Failed to end break", 500);
  }
}
```

### `app/api/clock/status/route.ts`
```typescript
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const entry = await prisma.timeEntry.findFirst({
      where: {
        employeeId: session.employeeId,
        clockOut: null,
        status: { in: ["IN_PROGRESS", "ON_BREAK"] },
      },
      include: { breaks: true },
      orderBy: { clockIn: "desc" },
    });

    if (!entry) {
      // Get last completed shift for "last shift" display
      const lastEntry = await prisma.timeEntry.findFirst({
        where: { employeeId: session.employeeId, status: "COMPLETED" },
        orderBy: { clockIn: "desc" },
        include: { breaks: true },
      });

      return Response.json(
        apiSuccess({
          isClockedIn: false,
          isOnBreak: false,
          currentEntry: null,
          elapsed: 0,
          breakSummary: [],
          lastEntry: lastEntry
            ? {
                clockIn: lastEntry.clockIn,
                clockOut: lastEntry.clockOut,
                hoursWorked: lastEntry.hoursWorked,
                breaks: lastEntry.breaks,
              }
            : null,
        })
      );
    }

    const openBreak = entry.breaks.find((b) => !b.endedAt);
    const elapsed = Math.floor((Date.now() - entry.clockIn.getTime()) / 1000);
    const breakElapsed = openBreak
      ? Math.floor((Date.now() - openBreak.startedAt.getTime()) / 1000)
      : 0;

    const breakSummary = entry.breaks.map((b) => ({
      id: b.id,
      breakType: b.breakType,
      startedAt: b.startedAt,
      endedAt: b.endedAt,
      durationMin: b.durationMin,
      isOpen: !b.endedAt,
    }));

    return Response.json(
      apiSuccess({
        isClockedIn: true,
        isOnBreak: entry.status === "ON_BREAK",
        currentEntry: {
          id: entry.id,
          clockIn: entry.clockIn,
          status: entry.status,
        },
        elapsed,
        breakElapsed,
        breakSummary,
        lastEntry: null,
      })
    );
  } catch {
    return apiError("Server error", "Failed to get clock status", 500);
  }
}
```

### `app/api/admin/clock/scan/route.ts`
Auto-detects IN vs OUT based on whether the employee has an open shift.
```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateHours } from "@/lib/time/hours-worked";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

const schema = z.object({ employeeId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "employeeId required");

    const { employeeId } = parsed.data;

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId, clockOut: null, status: { in: ["IN_PROGRESS", "ON_BREAK"] } },
      include: { breaks: true },
    });

    if (!openEntry) {
      // Clock IN
      const entry = await prisma.timeEntry.create({
        data: { employeeId, clockIn: new Date(), status: "IN_PROGRESS", clockInMethod: "QR_SCAN" },
      });
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      return Response.json(
        apiSuccess({ action: "CLOCKED_IN", entry, employee }, "Clocked in via QR")
      );
    } else {
      // Clock OUT
      const openBreak = openEntry.breaks.find((b) => !b.endedAt);
      if (openBreak) {
        const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
        await prisma.breakEntry.update({
          where: { id: openBreak.id },
          data: { endedAt: new Date(), durationMin },
        });
      }
      const clockOut = new Date();
      const hoursWorked = calculateHours(openEntry.clockIn, clockOut);
      const updated = await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { clockOut, hoursWorked, status: "COMPLETED", clockOutMethod: "QR_SCAN" },
      });
      await triggerAccrualForHoursWorked(employeeId, hoursWorked);
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      return Response.json(
        apiSuccess({ action: "CLOCKED_OUT", entry: updated, hoursWorked, employee }, "Clocked out via QR")
      );
    }
  } catch {
    return apiError("Server error", "QR scan failed", 500);
  }
}
```

### `app/api/admin/clock/live/route.ts`
Returns all employees with their current clock status.
```typescript
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);

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
```

### `app/api/admin/time-entries/[id]/route.ts`
HR edits a time entry, logs audit.
```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");

    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) return apiError("Not found", "Time entry not found", 404);

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...(parsed.data.clockIn && { clockIn: new Date(parsed.data.clockIn) }),
        ...(parsed.data.clockOut && { clockOut: new Date(parsed.data.clockOut) }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EDIT_TIME_ENTRY",
        targetId: id,
        targetTable: "TimeEntry",
        oldValue: { clockIn: existing.clockIn, clockOut: existing.clockOut, notes: existing.notes },
        newValue: { clockIn: updated.clockIn, clockOut: updated.clockOut, notes: updated.notes },
        reason: parsed.data.reason,
      },
    });

    return Response.json(apiSuccess(updated, "Time entry updated"));
  } catch {
    return apiError("Server error", "Failed to update time entry", 500);
  }
}
```

---

## Step 4 — Employee Clock Widget

Create `components/employee-portal/employee-clock-widget.tsx`:

This is a `"use client"` component. It has 4 states driven by `GET /api/clock/status` (polled every 30s):

1. **Not clocked in** — "Clock In" button + last shift summary if available
2. **Clocked in** — live elapsed timer (updates every second via `setInterval`), "Start Rest Break", "Start Meal Break", "Clock Out" buttons
3. **On break** — amber-colored break timer (updates every second), "End Break" button only
4. **Just clocked out** — summary card showing hours worked, total break time, auto-dismisses after 60 seconds

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Coffee, Utensils, LogOut, LogIn } from "lucide-react";
import { formatElapsed } from "@/lib/time/hours-worked";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ClockStatus = {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentEntry: { id: string; clockIn: string; status: string } | null;
  elapsed: number;
  breakElapsed: number;
  breakSummary: Array<{
    id: string;
    breakType: string;
    durationMin: number | null;
    isOpen: boolean;
  }>;
  lastEntry: {
    clockIn: string;
    clockOut: string | null;
    hoursWorked: number | null;
    breaks: Array<{ durationMin: number | null }>;
  } | null;
};

type PostClockOutData = {
  hoursWorked: number;
  totalBreakMin: number;
};

export function EmployeeClockWidget() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [justClockedOut, setJustClockedOut] = useState<PostClockOutData | null>(null);
  const [dismissTimer, setDismissTimer] = useState<NodeJS.Timeout | null>(null);

  const { data: status } = useQuery<ClockStatus>({
    queryKey: ["clock-status"],
    queryFn: async () => {
      const res = await fetch("/api/clock/status");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30_000,
  });

  // Live elapsed timer
  useEffect(() => {
    if (!status?.isClockedIn) return;
    setElapsed(status.elapsed);
    setBreakElapsed(status.breakElapsed ?? 0);
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
      if (status.isOnBreak) setBreakElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.isClockedIn, status?.isOnBreak, status?.elapsed, status?.breakElapsed]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["clock-status"] });
  }, [queryClient]);

  async function clockIn() {
    setLoading("in");
    await fetch("/api/clock/in", { method: "POST" });
    setLoading(null);
    setJustClockedOut(null);
    refresh();
  }

  async function clockOut() {
    setLoading("out");
    const res = await fetch("/api/clock/out", { method: "POST" });
    const json = await res.json();
    setLoading(null);
    if (json.data) {
      setJustClockedOut({ hoursWorked: json.data.hoursWorked, totalBreakMin: json.data.totalBreakMin });
      const t = setTimeout(() => setJustClockedOut(null), 60_000);
      setDismissTimer(t);
    }
    refresh();
  }

  async function startBreak(breakType: "REST" | "MEAL") {
    setLoading(`break-${breakType}`);
    await fetch("/api/clock/break/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakType }),
    });
    setLoading(null);
    refresh();
  }

  async function endBreak() {
    setLoading("break-end");
    await fetch("/api/clock/break/end", { method: "POST" });
    setLoading(null);
    refresh();
  }

  // Just clocked out summary
  if (justClockedOut) {
    const h = Math.floor(justClockedOut.hoursWorked);
    const m = Math.round((justClockedOut.hoursWorked - h) * 60);
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Shift complete</p>
              <p className="text-xs text-green-600">
                {h}h {m}m worked · {Math.round(justClockedOut.totalBreakMin)}m break
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (dismissTimer) clearTimeout(dismissTimer); setJustClockedOut(null); }}
            className="text-xs text-green-500 hover:text-green-700"
          >
            Dismiss
          </button>
        </CardContent>
      </Card>
    );
  }

  // On break
  if (status?.isOnBreak) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Coffee className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">On Break</p>
              <p className="text-xs font-mono text-amber-600">{formatElapsed(breakElapsed)}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={endBreak}
            disabled={loading === "break-end"}
          >
            End Break
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Clocked in
  if (status?.isClockedIn) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800">Clocked In</p>
                <p className="text-xs font-mono text-blue-600">{formatElapsed(elapsed)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-600 text-xs"
                onClick={() => startBreak("REST")}
                disabled={!!loading}
              >
                <Coffee className="h-3 w-3 mr-1" /> Rest
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-600 text-xs"
                onClick={() => startBreak("MEAL")}
                disabled={!!loading}
              >
                <Utensils className="h-3 w-3 mr-1" /> Meal
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white text-xs"
                onClick={clockOut}
                disabled={loading === "out"}
              >
                <LogOut className="h-3 w-3 mr-1" /> Clock Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not clocked in
  return (
    <Card>
      <CardContent className="py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Not clocked in</p>
            {status?.lastEntry && (
              <p className="text-xs text-slate-400">
                Last shift:{" "}
                {status.lastEntry.hoursWorked != null
                  ? `${Math.floor(status.lastEntry.hoursWorked)}h ${Math.round((status.lastEntry.hoursWorked % 1) * 60)}m`
                  : "—"}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={clockIn}
          disabled={loading === "in"}
          className="bg-primary text-primary-foreground"
        >
          <LogIn className="h-3 w-3 mr-1" /> Clock In
        </Button>
      </CardContent>
    </Card>
  );
}
```

Then in `components/employee-portal/employee-dashboard.tsx`, add the import and render the widget as the **first child** inside `<main className="flex-1 min-w-0 space-y-4">`:

```tsx
import { EmployeeClockWidget } from "./employee-clock-widget";

// inside <main ...>:
<EmployeeClockWidget />
<OnboardingTasksBanner />
// ... rest unchanged
```

---

## Step 5 — Admin Live Board

Replace `components/timesheet/admin-timesheet-placeholder.tsx` with a full component.
Create `components/timesheet/admin-live-board.tsx`:

This is a `"use client"` component with two sections:
1. **"Who's In Right Now"** — table of all employees, auto-refreshes every 60s via `useQuery refetchInterval: 60_000`
2. **Time Entries Table** — filters: Today / Week / Month / Custom date range. Columns: Employee, Clock In, Clock Out, Hours, Status, Actions (Approve, Edit, Flag, Add Entry)

For the live board table:
- 🟢 green dot = clocked in
- 🟡 amber dot = on break
- ⚪ gray dot = not clocked in
- Show formatted elapsed time (use `formatElapsed` from `lib/time/hours-worked`)
- Clicking a row navigates to `/admin/employees/[id]` (existing employee detail page)

The time entries table below fetches from a new endpoint:

### `app/api/admin/time-entries/route.ts` (list endpoint)
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "today";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    let start: Date, end: Date;

    if (range === "week") { start = startOfWeek(now); end = endOfWeek(now); }
    else if (range === "month") { start = startOfMonth(now); end = endOfMonth(now); }
    else if (range === "custom" && from && to) { start = new Date(from); end = new Date(to); }
    else { start = startOfDay(now); end = endOfDay(now); }

    const entries = await prisma.timeEntry.findMany({
      where: { clockIn: { gte: start, lte: end } },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        breaks: true,
      },
      orderBy: { clockIn: "desc" },
      take: 200,
    });

    return Response.json(apiSuccess(entries));
  } catch {
    return apiError("Server error", "Failed to fetch time entries", 500);
  }
}
```

Also add a `POST` to this same file to allow HR to manually add a time entry:
```typescript
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const body = await req.json();
    // Expect: { employeeId, clockIn, clockOut, reason }
    const entry = await prisma.timeEntry.create({
      data: {
        employeeId: body.employeeId,
        clockIn: new Date(body.clockIn),
        clockOut: body.clockOut ? new Date(body.clockOut) : null,
        hoursWorked: body.clockOut
          ? (new Date(body.clockOut).getTime() - new Date(body.clockIn).getTime()) / 3_600_000
          : null,
        status: body.clockOut ? "COMPLETED" : "IN_PROGRESS",
        clockInMethod: "MANUAL",
        clockOutMethod: body.clockOut ? "MANUAL" : null,
        notes: body.reason,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MANUAL_TIME_ENTRY",
        targetId: entry.id,
        targetTable: "TimeEntry",
        newValue: entry as object,
        reason: body.reason,
      },
    });
    return Response.json(apiSuccess(entry, "Entry added"));
  } catch {
    return apiError("Server error", "Failed to add entry", 500);
  }
}
```

Update `app/(dashboard)/admin/timesheet/page.tsx` to use the new live board:
```typescript
import { requireRole } from "@/lib/auth";
import { AdminLiveBoard } from "@/components/timesheet/admin-live-board";

export default async function AdminTimesheetPage() {
  await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
  return <AdminLiveBoard />;
}
```

---

## Step 6 — QR Scanner Page

### Install dependency
```bash
npm install html5-qrcode
```

### Create `app/(dashboard)/admin/clock/scanner/page.tsx`
```typescript
import { requireRole } from "@/lib/auth";
import { QrScannerClient } from "@/components/timesheet/qr-scanner-client";

export default async function QrScannerPage() {
  await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
  return <QrScannerClient />;
}
```

### Create `components/timesheet/qr-scanner-client.tsx`

This is a `"use client"` component. Key implementation notes:
- Import `Html5QrcodeScanner` from `html5-qrcode` dynamically (SSR-safe: `import("html5-qrcode").then(...)`)
- Initialize scanner in `useEffect`, clean up on unmount
- The QR token is stored on `Employee.qrCodeToken`. The existing `/api/employee/qr` shows the token is just a string. Extract it from the scanned value — the value may be a plain token or a URL like `https://domain.com?token=XYZ`. Handle both.
- On scan: call `POST /api/admin/clock/scan` with `{ employeeId }` — but we need employeeId from the token. So instead, create a lookup:
  - Add `GET /api/admin/clock/scan?token=XYZ` that looks up employee by `qrCodeToken` and returns their ID + name
  - Or change the scan flow: POST with `{ qrToken }` and look up employeeId server-side

**Preferred approach:** Change `POST /api/admin/clock/scan` to accept `{ qrToken }` OR `{ employeeId }`. Server looks up employee by `qrCodeToken` if `qrToken` is provided.

Update `app/api/admin/clock/scan/route.ts` to handle:
```typescript
const schema = z.object({
  employeeId: z.string().optional(),
  qrToken: z.string().optional(),
}).refine((d) => d.employeeId || d.qrToken, { message: "employeeId or qrToken required" });

// At start of POST handler, resolve employeeId:
let resolvedEmployeeId = parsed.data.employeeId;
if (!resolvedEmployeeId && parsed.data.qrToken) {
  const emp = await prisma.employee.findUnique({
    where: { qrCodeToken: parsed.data.qrToken },
    select: { id: true },
  });
  if (!emp) return apiError("Not found", "Unknown QR code", 404);
  resolvedEmployeeId = emp.id;
}
```

QR scanner component behavior:
- Full-screen with camera viewfinder in center
- Shows green card (`action: "CLOCKED_IN"`) or blue card (`action: "CLOCKED_OUT"`) with employee name after scan
- Card shows for 3 seconds then auto-clears, scanner re-activates
- 3-second debounce prevents double-scan
- Shows employee name + action + timestamp
- Works on mobile (back camera preferred: `facingMode: "environment"`)

---

## Step 7 — Manual Edit Modal

Create `components/timesheet/time-entry-edit-modal.tsx` — a dialog that:
- Takes `entryId`, `clockIn`, `clockOut`, `open`, `onClose`, `onSaved` as props
- Has datetime-local inputs for Clock In and Clock Out
- Has a required "Reason for edit" textarea
- On submit: calls `PATCH /api/admin/time-entries/[id]`
- Shows validation errors inline
- Calls `onSaved()` and closes on success

Use the existing `Dialog` component from `components/ui/dialog.tsx`.

---

## Step 8 — Missed Clock-Out Detection

Create `lib/time/missed-clockout.ts`:

```typescript
import { prisma } from "@/lib/prisma";

const MISSED_THRESHOLD_HOURS = 16;

/** Flag time entries where clockOut is null and clockIn > 16 hours ago */
export async function detectAndFlagMissedClockOuts(): Promise<number> {
  const threshold = new Date(Date.now() - MISSED_THRESHOLD_HOURS * 60 * 60 * 1000);

  const missed = await prisma.timeEntry.findMany({
    where: {
      clockOut: null,
      clockIn: { lt: threshold },
      status: { not: "FLAGGED" },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  for (const entry of missed) {
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { status: "FLAGGED" },
    });

    // Create admin notification via Notification model
    await prisma.notification.create({
      data: {
        employeeId: entry.employeeId,
        eventType: "MISSED_CLOCK_OUT",
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
        contentSnapshot: {
          title: "Missed Clock-Out",
          message: `⚠ ${entry.employee.firstName} ${entry.employee.lastName} never clocked out on ${entry.clockIn.toLocaleDateString()}.`,
        },
      },
    });
  }

  return missed.length;
}
```

Call this function:
1. At the top of `app/api/admin/clock/live/route.ts` (non-blocking, fire-and-forget): `detectAndFlagMissedClockOuts().catch(console.error)`
2. Also create `app/api/cron/missed-clockouts/route.ts` for a scheduled midnight cron:

```typescript
import { detectAndFlagMissedClockOuts } from "@/lib/time/missed-clockout";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: Request) {
  // Protect with CRON_SECRET env var
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const count = await detectAndFlagMissedClockOuts();
    return Response.json(apiSuccess({ flagged: count }));
  } catch {
    return apiError("Server error", "Cron failed", 500);
  }
}
```

---

## Navigation

Add a "Scanner" link in the admin sidebar/navigation pointing to `/admin/clock/scanner`. The existing navigation is in `lib/navigation.ts` — add an entry under the admin section.

---

## Implementation Order

1. Schema changes (`prisma/schema.prisma`) → `npm run db:push`
2. Rewrite `lib/time/hours-worked.ts`
3. Create all API routes (clock/in, clock/out, break/start, break/end, status, admin scan, admin live, admin time-entries CRUD, missed-clockouts cron)
4. Create `EmployeeClockWidget` component → add to `EmployeeDashboard`
5. Create `AdminLiveBoard` component → replace timesheet placeholder
6. Install `html5-qrcode` → create QR scanner page + component
7. Create `TimeEntryEditModal` component
8. Create `lib/time/missed-clockout.ts` → wire into live endpoint + cron route

---

## Key Conventions (match existing codebase)

- All API responses: `Response.json(apiSuccess(data, message))` or `apiError(title, message, status?)`
- Employee portal auth: `const session = await getEmployeeSession(); if (!session) return apiError(..., 401);`
- Admin auth: `const user = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);`
- Prisma client: `import { prisma } from "@/lib/prisma"`
- Run migrations: `npm run db:push`
- Components are in `components/`, organized by domain
- shadcn-style components are in `components/ui/` — use existing `Button`, `Card`, `Dialog`, `Input`, `Label`, `Textarea`
- Tailwind for all styling — no CSS modules
- `date-fns` for date math (already installed)
