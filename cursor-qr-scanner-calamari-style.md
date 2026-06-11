# Cursor Prompt — QR Scanner: Calamari-Style Choice Screen

## Reference UI
See Calamari.io's mobile clock screen. After scanning:
- If employee is NOT clocked in → auto clock IN, show green confirmation
- If employee IS clocked in → show a full-screen choice card with:
  - Employee name + live elapsed timer (HH:MM:SS in large teal font)
  - Big yellow BREAK button
  - Big red STOP button
- If employee IS on break → show:
  - Employee name + break timer
  - Big teal END BREAK button
  - Big red STOP/CLOCK OUT button

No auto-action on second scan. Employee must choose.

---

## Change 1 — Update `app/api/admin/clock/scan/route.ts`

Add optional `action` field to the request body. Change auto-detect logic:

- **No `action`** (first scan): check current status
  - Not clocked in → auto clock IN → return `{ action: "CLOCKED_IN", employee, entry }`
  - Clocked in (IN_PROGRESS) → return `{ action: "NEEDS_CHOICE", status: "IN_PROGRESS", employee, elapsed, entryId }`
  - On break (ON_BREAK) → return `{ action: "NEEDS_CHOICE", status: "ON_BREAK", employee, elapsed, breakElapsed, entryId }`

- **`action: "CLOCK_OUT"`**: close the entry, calc hoursWorked, trigger accrual → return `{ action: "CLOCKED_OUT", employee, hoursWorked }`
- **`action: "BREAK_START"`**: start a REST break → return `{ action: "BREAK_STARTED", employee }`
- **`action: "BREAK_END"`**: end open break → return `{ action: "BREAK_ENDED", employee }`

### Full replacement for `app/api/admin/clock/scan/route.ts`

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateHours } from "@/lib/time/hours-worked";
import { triggerAccrualForHoursWorked } from "@/lib/time/accrual-trigger";

const schema = z
  .object({
    employeeId: z.string().optional(),
    qrToken: z.string().optional(),
    action: z.enum(["CLOCK_OUT", "BREAK_START", "BREAK_END"]).optional(),
  })
  .refine((d) => d.employeeId || d.qrToken, { message: "employeeId or qrToken required" });

export async function POST(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "employeeId or qrToken required");

    // Resolve employee
    let employeeId = parsed.data.employeeId;
    if (!employeeId && parsed.data.qrToken) {
      const emp = await prisma.employee.findUnique({
        where: { qrCodeToken: parsed.data.qrToken },
        select: { id: true },
      });
      if (!emp) return apiError("Not found", "Unknown QR code", 404);
      employeeId = emp.id;
    }
    if (!employeeId) return apiError("Not found", "Employee not found", 404);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true },
    });

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId, clockOut: null, status: { in: ["IN_PROGRESS", "ON_BREAK"] } },
      include: { breaks: { where: { endedAt: null } } },
    });

    const { action } = parsed.data;

    // ── Explicit actions ──────────────────────────────────────────────

    if (action === "CLOCK_OUT") {
      if (!openEntry) return apiError("Not clocked in", "No active shift", 404);
      // Close open break if any
      const openBreak = openEntry.breaks[0];
      if (openBreak) {
        const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
        await prisma.breakEntry.update({ where: { id: openBreak.id }, data: { endedAt: new Date(), durationMin } });
      }
      const clockOut = new Date();
      // Fetch all breaks for net hours calculation
      const allBreaks = await prisma.breakEntry.findMany({ where: { timeEntryId: openEntry.id, endedAt: { not: null } } });
      const totalBreakMs = allBreaks.reduce((s, b) => s + (b.durationMin ?? 0) * 60000, 0);
      const rawMs = clockOut.getTime() - openEntry.clockIn.getTime();
      const hoursWorked = Math.max(0, (rawMs - totalBreakMs) / 3_600_000);
      await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { clockOut, hoursWorked, status: "COMPLETED", clockOutMethod: "QR_SCAN" },
      });
      await triggerAccrualForHoursWorked(employeeId, hoursWorked);
      return Response.json(apiSuccess({ action: "CLOCKED_OUT", employee, hoursWorked }, "Clocked out via QR"));
    }

    if (action === "BREAK_START") {
      if (!openEntry || openEntry.status !== "IN_PROGRESS")
        return apiError("Not available", "Not clocked in or already on break", 409);
      await prisma.$transaction([
        prisma.breakEntry.create({ data: { timeEntryId: openEntry.id, breakType: "REST", startedAt: new Date() } }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "ON_BREAK" } }),
      ]);
      return Response.json(apiSuccess({ action: "BREAK_STARTED", employee }, "Break started"));
    }

    if (action === "BREAK_END") {
      if (!openEntry || openEntry.status !== "ON_BREAK")
        return apiError("Not on break", "Employee is not on break", 409);
      const openBreak = openEntry.breaks[0];
      if (!openBreak) return apiError("No break", "No open break found", 404);
      const durationMin = (Date.now() - openBreak.startedAt.getTime()) / 60000;
      await prisma.$transaction([
        prisma.breakEntry.update({ where: { id: openBreak.id }, data: { endedAt: new Date(), durationMin } }),
        prisma.timeEntry.update({ where: { id: openEntry.id }, data: { status: "IN_PROGRESS" } }),
      ]);
      return Response.json(apiSuccess({ action: "BREAK_ENDED", employee }, "Break ended"));
    }

    // ── No action: first scan auto-detect ─────────────────────────────

    if (!openEntry) {
      // Not clocked in → auto clock IN
      const entry = await prisma.timeEntry.create({
        data: { employeeId, clockIn: new Date(), status: "IN_PROGRESS", clockInMethod: "QR_SCAN" },
      });
      return Response.json(apiSuccess({ action: "CLOCKED_IN", employee, entry }, "Clocked in via QR"));
    }

    // Already clocked in → return current status for choice screen
    const openBreak = openEntry.breaks[0];
    const elapsed = Math.floor((Date.now() - openEntry.clockIn.getTime()) / 1000);
    const breakElapsed = openBreak ? Math.floor((Date.now() - openBreak.startedAt.getTime()) / 1000) : 0;

    return Response.json(
      apiSuccess({
        action: "NEEDS_CHOICE",
        status: openEntry.status, // "IN_PROGRESS" or "ON_BREAK"
        employee,
        elapsed,
        breakElapsed,
        entryId: openEntry.id,
        qrToken: parsed.data.qrToken,
        employeeId,
      })
    );
  } catch {
    return apiError("Server error", "QR scan failed", 500);
  }
}
```

---

## Change 2 — Redesign `components/timesheet/qr-scanner-client.tsx`

Complete replacement. The component has these states:

```typescript
type ScannerState =
  | { type: "scanning" }
  | { type: "clocked_in"; employee: EmployeeName; timestamp: string }
  | { type: "clocked_out"; employee: EmployeeName; hoursWorked: number; timestamp: string }
  | { type: "break_started"; employee: EmployeeName }
  | { type: "break_ended"; employee: EmployeeName }
  | { type: "choice"; status: "IN_PROGRESS" | "ON_BREAK"; employee: EmployeeName; elapsed: number; breakElapsed: number; qrToken: string; employeeId: string }
  | { type: "error"; message: string };
```

### Scanner flow

```
QR scanned
    ↓
POST /api/admin/clock/scan { qrToken }
    ↓
action === "CLOCKED_IN"    → state = clocked_in  → auto-return to scanning after 3s
action === "NEEDS_CHOICE"  → state = choice      → show choice screen (no auto-dismiss)
    ↓ (user taps BREAK or STOP or END BREAK)
POST /api/admin/clock/scan { qrToken, action }
    ↓
action === "CLOCKED_OUT"   → state = clocked_out  → auto-return to scanning after 3s
action === "BREAK_STARTED" → state = break_started → auto-return after 3s
action === "BREAK_ENDED"   → state = break_ended  → auto-return after 3s
```

### Full component

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatElapsed } from "@/lib/time/hours-worked";

type EmployeeName = { firstName: string; lastName: string } | null;

type ScannerState =
  | { type: "scanning" }
  | { type: "clocked_in"; employee: EmployeeName; timestamp: string }
  | { type: "clocked_out"; employee: EmployeeName; hoursWorked: number; timestamp: string }
  | { type: "break_started"; employee: EmployeeName }
  | { type: "break_ended"; employee: EmployeeName }
  | { type: "choice"; status: "IN_PROGRESS" | "ON_BREAK"; employee: EmployeeName; elapsed: number; breakElapsed: number; qrToken: string; employeeId: string }
  | { type: "error"; message: string };

type CameraStatus = "requesting" | "active" | "denied" | "error";

function extractQrToken(scanned: string): string {
  try {
    const url = new URL(scanned.trim());
    return url.searchParams.get("token") ?? scanned.trim();
  } catch {
    return scanned.trim();
  }
}

function employeeName(e: EmployeeName) {
  if (!e) return "Employee";
  return `${e.firstName} ${e.lastName}`;
}

export function QrScannerClient() {
  const containerId = "qr-scanner-container";
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const debounceRef = useRef(false);
  const [state, setState] = useState<ScannerState>({ type: "scanning" });
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");

  // Live timer for choice screen
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveBreakElapsed, setLiveBreakElapsed] = useState(0);

  useEffect(() => {
    if (state.type !== "choice") return;
    setLiveElapsed(state.elapsed);
    setLiveBreakElapsed(state.breakElapsed);
    const interval = setInterval(() => {
      setLiveElapsed((e) => e + 1);
      if (state.status === "ON_BREAK") setLiveBreakElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.type, state.type === "choice" ? state.elapsed : 0, state.type === "choice" ? state.status : null]);

  const returnToScanning = useCallback((delay = 3000) => {
    setTimeout(() => {
      debounceRef.current = false;
      setState({ type: "scanning" });
    }, delay);
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    if (debounceRef.current) return;
    debounceRef.current = true;

    const qrToken = extractQrToken(decodedText);

    try {
      const res = await fetch("/api/admin/clock/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const json = await res.json();

      if (!res.ok) {
        setState({ type: "error", message: json.message ?? "Scan failed" });
        returnToScanning(3000);
        return;
      }

      const data = json.data;

      if (data.action === "CLOCKED_IN") {
        setState({ type: "clocked_in", employee: data.employee, timestamp: new Date().toLocaleTimeString() });
        returnToScanning(3000);
      } else if (data.action === "NEEDS_CHOICE") {
        // Don't return to scanning — wait for employee choice
        setState({
          type: "choice",
          status: data.status,
          employee: data.employee,
          elapsed: data.elapsed,
          breakElapsed: data.breakElapsed,
          qrToken,
          employeeId: data.employeeId,
        });
        // Debounce stays true until employee makes a choice or 30s timeout
        setTimeout(() => {
          debounceRef.current = false;
          setState((s) => (s.type === "choice" ? { type: "scanning" } : s));
        }, 30_000);
      }
    } catch {
      setState({ type: "error", message: "Network error" });
      returnToScanning(3000);
    }
  }, [returnToScanning]);

  async function doAction(qrToken: string, action: "CLOCK_OUT" | "BREAK_START" | "BREAK_END") {
    try {
      const res = await fetch("/api/admin/clock/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, action }),
      });
      const json = await res.json();

      if (!res.ok) {
        setState({ type: "error", message: json.message ?? "Action failed" });
        returnToScanning(3000);
        return;
      }

      const data = json.data;
      if (data.action === "CLOCKED_OUT") {
        setState({ type: "clocked_out", employee: data.employee, hoursWorked: data.hoursWorked, timestamp: new Date().toLocaleTimeString() });
      } else if (data.action === "BREAK_STARTED") {
        setState({ type: "break_started", employee: data.employee });
      } else if (data.action === "BREAK_ENDED") {
        setState({ type: "break_ended", employee: data.employee });
      }
      returnToScanning(3000);
    } catch {
      setState({ type: "error", message: "Network error" });
      returnToScanning(3000);
    }
  }

  // Start camera
  useEffect(() => {
    let stopped = false;
    async function startCamera() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        const scanner = new Html5Qrcode(containerId);
        await scanner.start(
          { facingMode: { ideal: "environment" } },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          handleScan,
          undefined
        );
        if (stopped) { await scanner.stop().catch(() => {}); return; }
        scannerRef.current = scanner;
        setCameraStatus("active");
      } catch (err) {
        if (stopped) return;
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        setCameraStatus(msg.includes("permission") || msg.includes("denied") ? "denied" : "error");
      }
    }
    startCamera();
    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [handleScan]);

  // ── Choice screen (Calamari-style) ──────────────────────────────────
  if (state.type === "choice") {
    const isOnBreak = state.status === "ON_BREAK";
    return (
      <div className="max-w-sm mx-auto">
        <PageHeader title="QR Clock Scanner" description="Employee action required" />

        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-teal-600 px-6 py-5 text-white text-center">
            <p className="text-lg font-semibold">{employeeName(state.employee)}</p>
            <p className="text-xs opacity-75 mt-0.5">
              {isOnBreak ? "Currently on break" : "Currently clocked in"}
            </p>
          </div>

          {/* Timer */}
          <div className="px-6 py-8 text-center">
            {isOnBreak ? (
              <>
                <p className="text-xs text-amber-500 font-medium uppercase tracking-widest mb-1">Break time</p>
                <p className="text-5xl font-mono font-light text-amber-500">{formatElapsed(liveBreakElapsed)}</p>
                <p className="text-xs text-slate-400 mt-2">Total shift: {formatElapsed(liveElapsed)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-teal-600 font-medium uppercase tracking-widest mb-1">Time worked</p>
                <p className="text-5xl font-mono font-light text-teal-600">{formatElapsed(liveElapsed)}</p>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-0 border-t">
            {isOnBreak ? (
              // On break: End Break | Clock Out
              <>
                <button
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-teal-500 hover:bg-teal-600 text-white transition-colors"
                  onClick={() => doAction(state.qrToken, "BREAK_END")}
                >
                  <span className="text-3xl">▶</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Resume</span>
                </button>
                <button
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-red-500 hover:bg-red-600 text-white transition-colors"
                  onClick={() => doAction(state.qrToken, "CLOCK_OUT")}
                >
                  <span className="w-8 h-8 bg-white/30 rounded flex items-center justify-center text-lg">■</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Stop</span>
                </button>
              </>
            ) : (
              // Clocked in: Break | Stop
              <>
                <button
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-amber-400 hover:bg-amber-500 text-white transition-colors"
                  onClick={() => doAction(state.qrToken, "BREAK_START")}
                >
                  <span className="text-3xl">☕</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Break</span>
                </button>
                <button
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-red-500 hover:bg-red-600 text-white transition-colors"
                  onClick={() => doAction(state.qrToken, "CLOCK_OUT")}
                >
                  <span className="w-8 h-8 bg-white/30 rounded flex items-center justify-center text-lg">■</span>
                  <span className="text-sm font-bold uppercase tracking-wider">Stop</span>
                </button>
              </>
            )}
          </div>

          {/* Cancel */}
          <button
            className="w-full py-3 text-xs text-slate-400 hover:text-slate-600 border-t"
            onClick={() => { debounceRef.current = false; setState({ type: "scanning" }); }}
          >
            Cancel — go back to scanning
          </button>
        </div>
      </div>
    );
  }

  // ── Confirmation cards ───────────────────────────────────────────────
  const confirmCard =
    state.type === "clocked_in" ? (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-xl font-semibold text-green-800">Clocked In</p>
        <p className="text-base text-green-700 mt-1">{employeeName(state.employee)}</p>
        <p className="text-xs text-green-500 mt-2">{state.timestamp}</p>
      </div>
    ) : state.type === "clocked_out" ? (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">👋</p>
        <p className="text-xl font-semibold text-blue-800">Clocked Out</p>
        <p className="text-base text-blue-700 mt-1">{employeeName(state.employee)}</p>
        <p className="text-sm text-blue-600 mt-1">
          {Math.floor(state.hoursWorked)}h {Math.round((state.hoursWorked % 1) * 60)}m worked
        </p>
        <p className="text-xs text-blue-500 mt-2">{state.timestamp}</p>
      </div>
    ) : state.type === "break_started" ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">☕</p>
        <p className="text-xl font-semibold text-amber-800">Break Started</p>
        <p className="text-base text-amber-700 mt-1">{employeeName(state.employee)}</p>
      </div>
    ) : state.type === "break_ended" ? (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">▶️</p>
        <p className="text-xl font-semibold text-teal-800">Break Ended</p>
        <p className="text-base text-teal-700 mt-1">{employeeName(state.employee)}</p>
      </div>
    ) : state.type === "error" ? (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-red-700">{state.message}</p>
      </div>
    ) : null;

  // ── Main layout: scanner + overlay cards ────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <PageHeader title="QR Clock Scanner" description="Scan employee QR codes to clock in or out" />

      {confirmCard && <div className="mb-4">{confirmCard}</div>}

      {cameraStatus === "requesting" && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Requesting camera access…
        </div>
      )}
      {cameraStatus === "denied" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          <p className="font-semibold mb-1">Camera access denied</p>
          <p>Allow camera permissions in your browser settings and reload.</p>
        </div>
      )}
      {cameraStatus === "error" && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-center text-sm text-yellow-800">
          <p className="font-semibold mb-1">Could not start camera</p>
          <p>Make sure no other app is using the camera, then reload.</p>
        </div>
      )}

      <div
        id={containerId}
        className={`rounded-xl overflow-hidden border bg-black min-h-[320px] ${cameraStatus !== "active" || state.type !== "scanning" ? "hidden" : ""}`}
      />

      {cameraStatus === "active" && state.type !== "scanning" && confirmCard === null && (
        <div className="rounded-xl border bg-black/5 min-h-[320px] flex items-center justify-center text-muted-foreground text-sm">
          Returning to scanner…
        </div>
      )}
    </div>
  );
}
```

---

## Summary of files to change

| File | Change |
|------|--------|
| `app/api/admin/clock/scan/route.ts` | Add `action` param; return `NEEDS_CHOICE` when already clocked in instead of auto-clocking out |
| `components/timesheet/qr-scanner-client.tsx` | Full replacement — multi-state scanner with Calamari-style choice screen |

No schema changes. No other files.

## Key behaviors

- **First scan** (not clocked in) → auto clock IN, green ✅ card for 3s, back to camera
- **Second scan** (clocked in) → show employee name + elapsed timer + BREAK (yellow) + STOP (red) buttons. Wait up to 30s for employee to choose, then auto-cancel back to scanning.
- **On break** → show RESUME (teal) + STOP (red) instead
- **After any action** → show confirmation card for 3s, back to scanning
- Camera stays running in background the whole time (the scanner `<div>` is hidden, not unmounted, during choice/confirmation screens)
