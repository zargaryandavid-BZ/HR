"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { formatElapsed } from "@/lib/time/hours-worked";

type EmployeeName = { firstName: string; lastName: string } | null;
type ClockAction = "CLOCK_OUT" | "BREAK_START_REST" | "BREAK_START_MEAL" | "BREAK_END";

type StationState =
  | { type: "idle" }
  | { type: "clocked_in"; employee: EmployeeName; timestamp: string }
  | { type: "clocked_out"; employee: EmployeeName; hoursWorked: number; timestamp: string }
  | { type: "break_started"; breakType: "REST" | "MEAL"; employee: EmployeeName }
  | { type: "break_ended"; breakType: "REST" | "MEAL"; employee: EmployeeName }
  | {
      type: "choice";
      status: "IN_PROGRESS" | "ON_BREAK";
      breakType: "REST" | "MEAL" | null;
      employee: EmployeeName;
      elapsed: number;
      breakElapsed: number;
      employeeNumber: string;
    }
  | {
      type: "confirming";
      action: ClockAction;
      label: string;
      emoji: string;
      confirmBg: string;
      confirmColor: string;
      employee: EmployeeName;
      employeeNumber: string;
    }
  | { type: "error"; message: string };

function empName(e: EmployeeName) {
  return e ? `${e.firstName} ${e.lastName}` : "Employee";
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
const CHOICE_TIMEOUT = 30;   // seconds before auto-returning to idle
const CONFIRM_TIMEOUT = 15;  // seconds before confirm screen auto-cancels

export function ClockStationClient() {
  const [state, setState] = useState<StationState>({ type: "idle" });
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveBreakElapsed, setLiveBreakElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Looking up…");
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // ── Live shift/break timers ──────────────────────────────────────────
  useEffect(() => {
    if (state.type !== "choice") return;
    setLiveElapsed(state.elapsed);
    setLiveBreakElapsed(state.breakElapsed);
    const id = setInterval(() => {
      setLiveElapsed((e) => e + 1);
      if (state.status === "ON_BREAK") setLiveBreakElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state.type === "choice" ? state.elapsed : null, state.type === "choice" ? state.status : null]); // eslint-disable-line

  // ── Countdown timer (choice + confirming screens) ────────────────────
  useEffect(() => {
    if (state.type !== "choice" && state.type !== "confirming") return;
    const limit = state.type === "confirming" ? CONFIRM_TIMEOUT : CHOICE_TIMEOUT;
    setCountdown(limit);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          returnToIdle();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.type]); // eslint-disable-line

  // ── Auto-dismiss confirmation cards after 3s ─────────────────────────
  useEffect(() => {
    if (!["clocked_in", "clocked_out", "break_started", "break_ended", "error"].includes(state.type)) return;
    const id = setTimeout(returnToIdle, 3000);
    return () => clearTimeout(id);
  }, [state.type]); // eslint-disable-line

  // ── Auto-submit when 6th digit entered ───────────────────────────────
  useEffect(() => {
    if (state.type === "idle" && inputValue.length === 6) {
      const id = setTimeout(() => handleSubmit(), 150);
      return () => clearTimeout(id);
    }
  }, [inputValue]); // eslint-disable-line

  function returnToIdle() {
    setState({ type: "idle" });
    setInputValue("");
    setCountdown(0);
  }

  const handleKeypad = useCallback((key: string) => {
    if (key === "C") { setInputValue(""); return; }
    if (key === "⌫") { setInputValue((v) => v.slice(0, -1)); return; }
    setInputValue((v) => (v.length < 6 ? v + key : v));
  }, []);

  // Physical keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.type !== "idle") return;
      if (e.key >= "0" && e.key <= "9") handleKeypad(e.key);
      else if (e.key === "Backspace") handleKeypad("⌫");
      else if (e.key === "Escape") handleKeypad("C");
      else if (e.key === "Enter" && inputValue.length === 6) handleSubmit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.type, inputValue, handleKeypad]); // eslint-disable-line

  async function handleSubmit() {
    const val = inputValue.trim();
    if (val.length !== 6 || loading) return;
    setLoading(true);

    // ── Collect GPS on mobile devices (server validates, client just reports) ──
    let coords: { lat: number; lng: number; accuracy?: number } | undefined;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && "geolocation" in navigator) {
      setLoadingMsg("Getting your location…");
      coords = await new Promise<typeof coords>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          () => resolve(undefined), // denied or failed — server will fall back to IP check
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
        );
      });
    }

    setLoadingMsg("Looking up…");
    try {
      const res = await fetch("/api/kiosk/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber: val, coords }),
      });
      const json = await res.json();
      setLoading(false);
      if (!res.ok) { setState({ type: "error", message: json.message ?? "Employee not found" }); return; }
      const data = json.data;
      if (data.action === "CLOCKED_IN") {
        // Clock-in already recorded — show confirmation card (intentional: employee entered their 6-digit PIN)
        setState({ type: "clocked_in", employee: data.employee, timestamp: new Date().toLocaleTimeString() });
      } else if (data.action === "NEEDS_CHOICE") {
        setState({
          type: "choice",
          status: data.status,
          breakType: data.breakType ?? null,
          employee: data.employee,
          elapsed: data.elapsed,
          breakElapsed: data.breakElapsed ?? 0,
          employeeNumber: val,
        });
      }
    } catch {
      setLoading(false);
      setState({ type: "error", message: "Network error. Please try again." });
    }
  }

  // First tap → go to confirming state
  function requestAction(
    employeeNumber: string,
    employee: EmployeeName,
    action: ClockAction,
    label: string,
    emoji: string,
    confirmBg: string,
    confirmColor: string
  ) {
    setState({ type: "confirming", action, label, emoji, confirmBg, confirmColor, employee, employeeNumber });
  }

  // Second tap → actually execute
  async function doAction(employeeNumber: string, action: ClockAction) {
    setLoading(true);
    try {
      const res = await fetch("/api/kiosk/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber, action }),
      });
      const json = await res.json();
      setLoading(false);
      if (!res.ok) { setState({ type: "error", message: json.message ?? "Action failed" }); return; }
      const data = json.data;
      if (data.action === "CLOCKED_OUT") setState({ type: "clocked_out", employee: data.employee, hoursWorked: data.hoursWorked, timestamp: new Date().toLocaleTimeString() });
      else if (data.action === "BREAK_STARTED") setState({ type: "break_started", breakType: data.breakType, employee: data.employee });
      else if (data.action === "BREAK_ENDED") setState({ type: "break_ended", breakType: data.breakType, employee: data.employee });
    } catch {
      setLoading(false);
      setState({ type: "error", message: "Network error." });
    }
  }

  // ── CONFIRMING screen ────────────────────────────────────────────────
  if (state.type === "confirming") {
    const progress = (countdown / CONFIRM_TIMEOUT) * 100;
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div style={{ background: "#0F6E56", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#E1F5EE" }}>{empName(state.employee)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5DCAA5" }}>Confirm your selection</p>
          </div>
          <button onClick={returnToIdle}
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#E1F5EE", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Countdown bar */}
        <div style={{ height: 3, background: "#e2e8f0" }}>
          <div style={{ height: "100%", background: "#0F6E56", width: `${progress}%`, transition: "width 1s linear" }} />
        </div>

        {/* Confirmation content */}
        <div style={{ padding: "36px 28px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{state.emoji}</div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1e293b" }}>
            {state.label}?
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#94a3b8" }}>
            Tap <strong>Confirm</strong> to proceed, or <strong>Cancel</strong> to go back.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 20px 20px" }}>
          <button onClick={returnToIdle} disabled={loading}
            style={{ height: 56, border: "1.5px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", color: "#475569", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => doAction(state.employeeNumber, state.action)} disabled={loading}
            style={{ height: 56, border: "none", borderRadius: 12, background: state.confirmBg, color: state.confirmColor, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "…" : "Confirm"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", paddingBottom: 14, margin: 0 }}>
          Auto-cancel in {countdown}s
        </p>
      </div>
    );
  }

  // ── CHOICE screen ────────────────────────────────────────────────────
  if (state.type === "choice") {
    const isOnBreak = state.status === "ON_BREAK";
    const isLunch = state.breakType === "MEAL";
    const progress = (countdown / CHOICE_TIMEOUT) * 100;
    const { employeeNumber, employee } = state;

    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {/* Header with X */}
        <div style={{ background: "#0F6E56", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#E1F5EE" }}>{empName(employee)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5DCAA5" }}>
              {isOnBreak ? (isLunch ? "On lunch break" : "On rest break") : "Clocked in"}
            </p>
          </div>
          <button onClick={returnToIdle}
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#E1F5EE", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Countdown bar */}
        <div style={{ height: 3, background: "#e2e8f0" }}>
          <div style={{ height: "100%", background: "#0F6E56", width: `${progress}%`, transition: "width 1s linear" }} />
        </div>

        {/* Timer */}
        <div style={{ padding: "24px 24px 18px", textAlign: "center" }}>
          {isOnBreak ? (
            <>
              <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500, color: isLunch ? "#185FA5" : "#854F0B" }}>
                {isLunch ? "Lunch break time" : "Rest break time"}
              </p>
              <p style={{ margin: 0, fontSize: 44, fontFamily: "var(--font-mono)", fontWeight: 400, color: isLunch ? "#378ADD" : "#BA7517" }}>
                {formatElapsed(liveBreakElapsed)}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>Total shift: {formatElapsed(liveElapsed)}</p>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500, color: "#0F6E56" }}>Time worked</p>
              <p style={{ margin: 0, fontSize: 44, fontFamily: "var(--font-mono)", fontWeight: 400, color: "#0F6E56" }}>
                {formatElapsed(liveElapsed)}
              </p>
            </>
          )}
        </div>

        {/* Action buttons — first tap triggers confirmation */}
        {isOnBreak ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #e2e8f0" }}>
            <button disabled={loading}
              onClick={() => requestAction(employeeNumber, employee, "BREAK_END", isLunch ? "End Lunch" : "End Break", "▶", "#5DCAA5", "#04342C")}
              style={{ border: "none", borderRight: "1px solid #e2e8f0", padding: "22px 8px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", background: "#5DCAA5", color: "#04342C" }}>
              <span style={{ fontSize: 26 }}>▶</span>
              {isLunch ? "End Lunch" : "End Break"}
            </button>
            <button disabled={loading}
              onClick={() => requestAction(employeeNumber, employee, "CLOCK_OUT", "Clock Out", "👋", "#ef4444", "#ffffff")}
              style={{ border: "none", padding: "22px 8px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", background: "#F09595", color: "#501313" }}>
              <span style={{ fontSize: 26 }}>■</span>
              Clock Out
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid #e2e8f0" }}>
            <button disabled={loading}
              onClick={() => requestAction(employeeNumber, employee, "BREAK_START_REST", "Start Rest Break", "☕", "#FAEEDA", "#633806")}
              style={{ border: "none", borderRight: "1px solid #e2e8f0", padding: "20px 6px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", background: "#FAEEDA", color: "#633806" }}>
              <span style={{ fontSize: 24 }}>☕</span>
              Rest Break
            </button>
            <button disabled={loading}
              onClick={() => requestAction(employeeNumber, employee, "BREAK_START_MEAL", "Start Lunch Break", "🍽", "#E6F1FB", "#0C447C")}
              style={{ border: "none", borderRight: "1px solid #e2e8f0", padding: "20px 6px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", background: "#E6F1FB", color: "#0C447C" }}>
              <span style={{ fontSize: 24 }}>🍽</span>
              Lunch
            </button>
            <button disabled={loading}
              onClick={() => requestAction(employeeNumber, employee, "CLOCK_OUT", "Clock Out", "👋", "#ef4444", "#ffffff")}
              style={{ border: "none", padding: "20px 6px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", background: "#F09595", color: "#501313" }}>
              <span style={{ fontSize: 24 }}>■</span>
              Clock Out
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", padding: "10px 0 12px", margin: 0 }}>
          Auto-cancel in {countdown}s
        </p>
      </div>
    );
  }

  // ── Confirmation cards ───────────────────────────────────────────────
  if (state.type === "clocked_in") return (
    <div className="rounded-2xl border text-center shadow-sm" style={{ borderColor: "#9FE1CB", background: "#E1F5EE", padding: "40px 24px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#9FE1CB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30 }}>✓</div>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#085041" }}>Clocked In</p>
      <p style={{ margin: "8px 0 0", fontSize: 16, color: "#0F6E56" }}>{empName(state.employee)}</p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#1D9E75" }}>{state.timestamp}</p>
      <button onClick={returnToIdle} style={{ marginTop: 16, border: "none", background: "none", fontSize: 12, color: "#1D9E75", cursor: "pointer" }}>✕ Close</button>
    </div>
  );

  if (state.type === "clocked_out") {
    const h = Math.floor(state.hoursWorked);
    const m = Math.round((state.hoursWorked - h) * 60);
    return (
      <div className="rounded-2xl border text-center shadow-sm" style={{ borderColor: "#B5D4F4", background: "#E6F1FB", padding: "40px 24px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#B5D4F4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30 }}>👋</div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#0C447C" }}>Clocked Out</p>
        <p style={{ margin: "8px 0 0", fontSize: 16, color: "#185FA5" }}>{empName(state.employee)}</p>
        <p style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 500, color: "#185FA5" }}>{h}h {m}m worked</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#378ADD" }}>{state.timestamp}</p>
        <button onClick={returnToIdle} style={{ marginTop: 16, border: "none", background: "none", fontSize: 12, color: "#378ADD", cursor: "pointer" }}>✕ Close</button>
      </div>
    );
  }

  if (state.type === "break_started") {
    const isLunch = state.breakType === "MEAL";
    return (
      <div className="rounded-2xl border text-center shadow-sm" style={{ borderColor: isLunch ? "#B5D4F4" : "#FAC775", background: isLunch ? "#E6F1FB" : "#FAEEDA", padding: "40px 24px" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>{isLunch ? "🍽" : "☕"}</div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: isLunch ? "#0C447C" : "#633806" }}>{isLunch ? "Lunch Break" : "Rest Break"}</p>
        <p style={{ margin: "8px 0 0", fontSize: 16, color: isLunch ? "#185FA5" : "#854F0B" }}>{empName(state.employee)}</p>
        <button onClick={returnToIdle} style={{ marginTop: 16, border: "none", background: "none", fontSize: 12, color: isLunch ? "#185FA5" : "#854F0B", cursor: "pointer" }}>✕ Close</button>
      </div>
    );
  }

  if (state.type === "break_ended") {
    const isLunch = state.breakType === "MEAL";
    return (
      <div className="rounded-2xl border text-center shadow-sm" style={{ borderColor: "#9FE1CB", background: "#E1F5EE", padding: "40px 24px" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>▶️</div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#085041" }}>{isLunch ? "Lunch Ended" : "Break Ended"}</p>
        <p style={{ margin: "8px 0 0", fontSize: 16, color: "#0F6E56" }}>{empName(state.employee)}</p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#1D9E75" }}>Back to work</p>
        <button onClick={returnToIdle} style={{ marginTop: 16, border: "none", background: "none", fontSize: 12, color: "#1D9E75", cursor: "pointer" }}>✕ Close</button>
      </div>
    );
  }

  if (state.type === "error") return (
    <div className="rounded-2xl border text-center shadow-sm" style={{ borderColor: "#F7C1C1", background: "#FCEBEB", padding: "32px 24px" }}>
      <p style={{ margin: 0, fontSize: 15, color: "#501313" }}>{state.message}</p>
      <button onClick={returnToIdle} style={{ marginTop: 12, border: "none", background: "none", fontSize: 12, color: "#A32D2D", cursor: "pointer" }}>✕ Try again</button>
    </div>
  );

  // ── ID Entry + Keypad ────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Display */}
      <div style={{ background: "#0F6E56", padding: "24px 24px 20px", textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#5DCAA5", letterSpacing: ".06em", textTransform: "uppercase" }}>
          Enter Employee ID
        </p>
        <div style={{ background: "rgba(0,0,0,.2)", borderRadius: 12, padding: "14px 20px", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {inputValue ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 400, color: "#E1F5EE", letterSpacing: ".15em" }}>
              {inputValue}
            </span>
          ) : (
            <span style={{ fontSize: 15, color: "rgba(255,255,255,.35)" }}>_ _ _ _ _ _</span>
          )}
        </div>
        <input
          ref={hiddenInputRef}
          type="tel"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
          tabIndex={-1}
        />
      </div>

      {/* Keypad */}
      <div style={{ padding: "16px", background: "#f8fafc" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {KEYPAD_KEYS.map((key) => {
            const isClear = key === "C";
            const isBack = key === "⌫";
            return (
              <button
                key={key}
                onClick={() => handleKeypad(key)}
                disabled={loading}
                style={{
                  height: 64,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: isClear ? "#FCEBEB" : isBack ? "#f1f5f9" : "#ffffff",
                  color: isClear ? "#A32D2D" : "#1e293b",
                  fontSize: isBack ? 20 : 22,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                  transition: "background .1s",
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isClear ? "#F7C1C1" : "#e2e8f0"; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isClear ? "#FCEBEB" : isBack ? "#f1f5f9" : "#ffffff"; }}
                onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isClear ? "#F7C1C1" : "#e2e8f0"; }}
                onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isClear ? "#FCEBEB" : isBack ? "#f1f5f9" : "#ffffff"; }}
              >
                {key}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || inputValue.length !== 6}
          style={{
            width: "100%",
            marginTop: 12,
            height: 56,
            border: "none",
            borderRadius: 12,
            background: inputValue.length === 6 && !loading ? "#0F6E56" : "#94a3b8",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 500,
            cursor: inputValue.length === 6 && !loading ? "pointer" : "not-allowed",
            transition: "background .15s",
            letterSpacing: ".03em",
          }}
        >
          {loading ? loadingMsg : "Continue →"}
        </button>
      </div>
    </div>
  );
}
