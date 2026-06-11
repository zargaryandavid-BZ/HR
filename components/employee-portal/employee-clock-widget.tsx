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

type PendingConfirm = {
  label: string;
  description: string;
  onConfirm: () => void;
};

export function EmployeeClockWidget() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [justClockedOut, setJustClockedOut] = useState<PostClockOutData | null>(null);
  const [dismissTimer, setDismissTimer] = useState<NodeJS.Timeout | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  /** Collect GPS from browser (desktop + mobile); falls back to server-side IP check if denied. */
  async function getCoords(): Promise<{ lat: number; lng: number; accuracy?: number } | undefined> {
    if (!("geolocation" in navigator)) return undefined;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(undefined), // denied/failed → server falls back to IP check
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
    });
  }

  /** POST to a clock endpoint with optional GPS coords; returns parsed JSON or throws. */
  async function clockFetch(url: string, extra?: Record<string, unknown>): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    const coords = await getCoords();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, coords }),
    });
    const json = await res.json();
    return { ok: res.ok, json };
  }

  const { data: status } = useQuery<ClockStatus>({
    queryKey: ["clock-status"],
    queryFn: async () => {
      const res = await fetch("/api/clock/status");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30_000,
  });

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
    setLocationError(null);
    const { ok, json } = await clockFetch("/api/clock/in");
    setLoading(null);
    if (!ok) { setLocationError((json as { message?: string }).message ?? "Clock in failed"); return; }
    setJustClockedOut(null);
    refresh();
  }

  async function clockOut() {
    setLoading("out");
    setLocationError(null);
    const { ok, json } = await clockFetch("/api/clock/out");
    setLoading(null);
    if (!ok) { setLocationError((json as { message?: string }).message ?? "Clock out failed"); return; }
    const data = (json as { data?: { hoursWorked: number; totalBreakMin: number } }).data;
    if (data) {
      setJustClockedOut({ hoursWorked: data.hoursWorked, totalBreakMin: data.totalBreakMin });
      const t = setTimeout(() => setJustClockedOut(null), 60_000);
      setDismissTimer(t);
    }
    refresh();
  }

  async function startBreak(breakType: "REST" | "MEAL") {
    setLoading(`break-${breakType}`);
    setLocationError(null);
    const { ok, json } = await clockFetch("/api/clock/break/start", { breakType });
    setLoading(null);
    if (!ok) { setLocationError((json as { message?: string }).message ?? "Action failed"); return; }
    refresh();
  }

  async function endBreak() {
    setLoading("break-end");
    setLocationError(null);
    const { ok, json } = await clockFetch("/api/clock/break/end");
    setLoading(null);
    if (!ok) { setLocationError((json as { message?: string }).message ?? "Action failed"); return; }
    refresh();
  }

  const locationBanner = locationError ? (
    <Card className="mb-2 border-red-200 bg-red-50">
      <CardContent className="py-2 px-4 flex items-center justify-between gap-3">
        <p className="text-sm text-red-700">{locationError}</p>
        <button onClick={() => setLocationError(null)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕</button>
      </CardContent>
    </Card>
  ) : null;

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
            onClick={() => {
              if (dismissTimer) clearTimeout(dismissTimer);
              setJustClockedOut(null);
            }}
            className="text-xs text-green-500 hover:text-green-700"
          >
            Dismiss
          </button>
        </CardContent>
      </Card>
    );
  }

  if (status?.isOnBreak) {
    return (
      <>
        {locationBanner}
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
              onClick={() =>
                setConfirm({
                  label: "End Break",
                  description: "End your break and resume work?",
                  onConfirm: endBreak,
                })
              }
              disabled={!!loading || !!confirm}
            >
              End Break
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (status?.isClockedIn) {
    return (
      <>
        {locationBanner}
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
                  onClick={() =>
                    setConfirm({
                      label: "Start Rest Break",
                      description: "Start a rest break?",
                      onConfirm: () => startBreak("REST"),
                    })
                  }
                  disabled={!!loading || !!confirm}
                >
                  <Coffee className="h-3 w-3 mr-1" /> Rest
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-600 text-xs"
                  onClick={() =>
                    setConfirm({
                      label: "Start Meal Break",
                      description: "Start a meal break?",
                      onConfirm: () => startBreak("MEAL"),
                    })
                  }
                  disabled={!!loading || !!confirm}
                >
                  <Utensils className="h-3 w-3 mr-1" /> Meal
                </Button>
                <Button
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white text-xs"
                  onClick={() =>
                    setConfirm({
                      label: "Clock Out",
                      description: "Are you sure you want to clock out?",
                      onConfirm: clockOut,
                    })
                  }
                  disabled={!!loading || !!confirm}
                >
                  <LogOut className="h-3 w-3 mr-1" /> Clock Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {locationBanner}
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
                    ? `${Math.floor(status.lastEntry.hoursWorked)}h ${Math.round(
                        (status.lastEntry.hoursWorked % 1) * 60
                      )}m`
                    : "—"}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() =>
              setConfirm({
                label: "Clock In",
                description: "Confirm clock in?",
                onConfirm: clockIn,
              })
            }
            disabled={!!loading || !!confirm}
            className="bg-primary text-primary-foreground"
          >
            <LogIn className="h-3 w-3 mr-1" /> Clock In
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
