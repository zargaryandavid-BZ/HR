"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type EmployeeOption = {
  id: string;
  name: string;
  maskedPhone: string | null;
};

export default function EmployeeLoginPage() {
  return (
    <Suspense>
      <EmployeeLoginForm />
    </Suspense>
  );
}

function EmployeeLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/employee/dashboard";
  const errorParam = searchParams.get("error");

  const [step, setStep] = useState<"select" | "otp">("select");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmployeeOption | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Load employee list on mount
  useEffect(() => {
    fetch("/api/employee/auth/employees")
      .then((r) => r.json())
      .then((j) => setEmployees(j.data ?? []))
      .finally(() => setLoadingEmployees(false));
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSendCode() {
    if (!selected) return;
    setError(null);
    setLoading(true);

    // Request location permission at the same time as SMS — browser shows the
    // permission dialog now so the clock-in widget doesn't need to ask again.
    if ("geolocation" in navigator) {
      setLocationStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus("granted"),
        () => setLocationStatus("denied"),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
    }

    try {
      await fetch("/api/employee/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id }),
      });
      setStep("otp");
      setResendCountdown(30);
      setDigits(Array(6).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && index === 5 && next.every(Boolean)) handleVerify(next.join(""));
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setDigits(pasted.split(""));
      setTimeout(() => handleVerify(pasted), 50);
    }
  }

  async function handleVerify(code: string) {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/employee/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Incorrect code. Try again.");
        setDigits(Array(6).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        router.push(redirect);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!selected) return;
    setError(null);
    setDigits(Array(6).fill(""));
    setLoading(true);
    try {
      await fetch("/api/employee/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id }),
      });
      setResendCountdown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-xl font-bold mb-4">
            HR
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Bazaar Printing</p>
        </div>

        {errorParam === "invalid_token" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 text-center">
            Your portal link has expired. Please sign in below.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {step === "select" ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 text-center">
                Select your name to sign in
              </p>

              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search your name…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                  className="w-full rounded-lg border border-input bg-slate-50 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Employee list — always visible */}
              <div className="rounded-lg border overflow-hidden">
                {loadingEmployees ? (
                  <div className="flex flex-col gap-2 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-11 rounded-md bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">
                    {search ? "No employees match your search." : "No employees found."}
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {filtered.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => { setSelected(emp); setError(null); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${
                          selected?.id === emp.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">{emp.name}</span>
                        {emp.maskedPhone && (
                          <span className={`text-xs font-mono ${selected?.id === emp.id ? "text-primary-foreground/70" : "text-slate-400"}`}>
                            {emp.maskedPhone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Masked phone confirmation */}
              {selected?.maskedPhone && (
                <p className="text-xs text-center text-slate-500">
                  A code will be sent to{" "}
                  <span className="font-mono font-medium">{selected.maskedPhone}</span>
                </p>
              )}

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button
                className="w-full"
                onClick={handleSendCode}
                disabled={!selected || loading}
              >
                {loading ? "Sending…" : "Send verification code"}
              </Button>

              {locationStatus === "requesting" && (
                <p className="text-xs text-center text-slate-400">
                  📍 Allow location access when prompted — needed for clock-in
                </p>
              )}
              {locationStatus === "granted" && (
                <p className="text-xs text-center text-green-600">
                  ✓ Location access granted
                </p>
              )}
              {locationStatus === "denied" && (
                <p className="text-xs text-center text-amber-600">
                  ⚠ Location access denied — you may not be able to clock in remotely
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Enter the 6-digit code sent to</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {selected?.maskedPhone ?? "your phone"}
                </p>
              </div>

              {/* OTP boxes */}
              <div className="flex gap-2 justify-center" onPaste={handleDigitPaste}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-11 h-14 rounded-xl border-2 text-center text-xl font-bold bg-white focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
                    disabled={loading}
                  />
                ))}
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button
                className="w-full"
                onClick={() => handleVerify(digits.join(""))}
                disabled={digits.some((d) => !d) || loading}
              >
                {loading ? "Verifying…" : "Verify code"}
              </Button>

              <div className="text-center">
                {resendCountdown > 0 ? (
                  <p className="text-xs text-slate-500">Resend code in {resendCountdown}s</p>
                ) : (
                  <button className="text-xs text-primary hover:underline" onClick={handleResend} disabled={loading}>
                    Resend code
                  </button>
                )}
              </div>

              <button
                className="text-xs text-slate-400 hover:text-slate-600 w-full text-center"
                onClick={() => { setStep("select"); setError(null); setDigits(Array(6).fill("")); }}
              >
                ← Choose a different name
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
