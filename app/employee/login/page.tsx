"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Formats a raw digits-only string to +1 (XXX) XXX-XXXX */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 1) return `+${digits}`;
  const country = digits[0] === "1" ? "1" : "1";
  const rest = digits.startsWith("1") ? digits.slice(1) : digits;
  const area = rest.slice(0, 3);
  const mid = rest.slice(3, 6);
  const end = rest.slice(6, 10);
  let result = `+${country}`;
  if (area) result += ` (${area}`;
  if (area.length === 3) result += ")";
  if (mid) result += ` ${mid}`;
  if (end) result += `-${end}`;
  return result;
}

/** Employee portal OTP login page */
export default function EmployeeLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/employee/dashboard";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  function handlePhoneChange(value: string) {
    const raw = value.replace(/\D/g, "").slice(0, 11);
    setRawPhone(raw);
    setPhone(formatPhone(raw));
  }

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/employee/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rawPhone.startsWith("1") ? `+${rawPhone}` : `+1${rawPhone}` }),
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
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 filled
    if (digit && index === 5 && next.every(Boolean)) {
      handleVerify(next.join(""));
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
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
      const next = pasted.split("");
      setDigits(next);
      setTimeout(() => handleVerify(pasted), 50);
    }
  }

  async function handleVerify(code: string) {
    setError(null);
    setLoading(true);
    try {
      const normalised = rawPhone.startsWith("1") ? `+${rawPhone}` : `+1${rawPhone}`;
      const res = await fetch("/api/employee/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised, code }),
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
    setError(null);
    setDigits(Array(6).fill(""));
    setLoading(true);
    try {
      const normalised = rawPhone.startsWith("1") ? `+${rawPhone}` : `+1${rawPhone}`;
      await fetch("/api/employee/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised }),
      });
      setResendCountdown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-xl font-bold mb-4">
            PP
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Pixel Press Print Inc</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {step === "phone" ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-medium text-slate-700">Sign in with your phone number</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && rawPhone.length >= 10 && handleSendOtp()}
                  autoFocus
                  className="text-base"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleSendOtp}
                disabled={rawPhone.replace(/^1/, "").length < 10 || loading}
              >
                {loading ? "Sending…" : "Send code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Enter the 6-digit code sent to</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{phone}</p>
              </div>

              {/* 6-box OTP input */}
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
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={handleResend}
                    disabled={loading}
                  >
                    Resend code
                  </button>
                )}
              </div>

              <button
                className="text-xs text-slate-400 hover:text-slate-600 w-full text-center"
                onClick={() => { setStep("phone"); setError(null); }}
              >
                ← Use a different number
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
