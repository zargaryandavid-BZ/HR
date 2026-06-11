"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { format } from "date-fns";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TShirtSize } from "@prisma/client";
import { ImportantDatesPanel } from "./important-dates-panel";
import { EmployeePreferencesSection } from "./employee-preferences-section";

type MeData = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  // Contact
  phone?: string | null;
  personalEmail?: string | null;
  workEmail?: string | null;
  // Address
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  // Personal
  birthdate?: string | null;
  // Employment
  jobTitle?: string | null;
  employmentType?: string;
  startDate?: string | null;
  /** May be string (old me API) or object (admin preview / new me API) */
  department?: string | { name: string } | null;
  position?: string | { name: string } | null;
  /** May be string (old me API) or object (admin preview / new me API) */
  manager?: string | { firstName: string; lastName: string } | null;
  // Compensation
  payType?: string | null;
  payRate?: number | null;
  payFrequency?: string | null;
  isNonExempt?: boolean | null;
  overtimeEligible?: boolean | null;
  compensationEffectiveDate?: string | null;
  // Emergency contact
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
  // Preferences
  tshirtSize?: string | null;
  allergyInfo?: string | null;
  // QR
  qrCodeToken?: string | null;
};

type QrData = {
  qrCodeToken: string | null;
  employeeNumber: string | null;
  appUrl: string;
  clockStatus: { type: "CLOCK_IN" | "CLOCK_OUT"; timestamp: string } | null;
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
};

const PAY_FREQ_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  SEMI_MONTHLY: "Twice monthly",
  MONTHLY: "Monthly",
};

function formatPayRate(rate: number, type: string): string {
  if (type === "HOURLY") return `$${rate.toFixed(2)} / hr`;
  return `$${rate.toLocaleString("en-US", { minimumFractionDigits: 0 })} / yr`;
}

function resolveString(val: string | { name: string } | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === "object" && "name" in val) return val.name;
  return val;
}

function resolveManager(val: string | { firstName: string; lastName: string } | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === "object") return `${val.firstName} ${val.lastName}`;
  return val;
}

/** A single labeled info row */
function InfoRow({ label, value, muted }: { label: string; value?: string | null; muted?: boolean }) {
  const isEmpty = !value;
  return (
    <div className="flex gap-1.5 items-start text-[11px]">
      <span className="text-muted-foreground shrink-0 w-[68px]">{label}</span>
      <span className={cn("font-medium leading-snug break-words min-w-0 flex-1", (isEmpty || muted) && "text-muted-foreground font-normal")}>
        {value || "—"}
      </span>
    </div>
  );
}

/** Sub-section label with separator */
function SectionLabel({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div className={cn("border-b pb-1", first ? "mb-2" : "mt-3.5 mb-2")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/** Sidebar: QR code card + expanded personal info with 4 sub-sections */
export function EmployeeSidebar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [personalVisible, setPersonalVisible] = useState(true);

  const { data: me, isLoading: meLoading } = useQuery<MeData>({
    queryKey: ["employee-me"],
    queryFn: async () => {
      const res = await fetch("/api/employee/me");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: qrData } = useQuery<QrData>({
    queryKey: ["employee-qr"],
    queryFn: async () => {
      const res = await fetch("/api/employee/qr");
      const json = await res.json();
      return json.data;
    },
  });

  useEffect(() => {
    if (!qrData?.qrCodeToken) return;
    const url = `${qrData.appUrl}/kiosk/scan?token=${qrData.qrCodeToken}`;
    QRCode.toDataURL(url, { width: 136, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrData]);

  const clockStatus = qrData?.clockStatus;
  const isClockedIn = clockStatus?.type === "CLOCK_IN";
  const clockTime = clockStatus?.timestamp
    ? format(new Date(clockStatus.timestamp), "h:mm a")
    : null;

  const fullName = me ? `${me.preferredName ?? me.firstName} ${me.lastName}` : "";

  function handleSaveQr() {
    if (!qrDataUrl) return;
    const canvas = document.createElement("canvas");
    canvas.width = 180; canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 180, 200);
      ctx.drawImage(img, 22, 8, 136, 136);
      ctx.fillStyle = "#111"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(fullName, 90, 162);
      ctx.font = "10px sans-serif"; ctx.fillStyle = "#666";
      ctx.fillText("Pixel Press Print Inc", 90, 176);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fullName.replace(/\s/g, "-")}-qr.png`;
        a.click();
      });
    };
    img.src = qrDataUrl;
  }

  function handlePrintQr() {
    if (!qrDataUrl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code — ${fullName}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}
      img{width:200px;height:200px} p{margin:8px 0 0;font-size:13px;font-weight:600}</style></head>
      <body><img src="${qrDataUrl}"/><p>${fullName}</p><script>window.onload=()=>window.print()</script></body></html>
    `);
  }

  if (meLoading) {
    return (
      <aside className="w-[260px] shrink-0 space-y-4">
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </aside>
    );
  }

  // --- Derived values ---
  const deptName = resolveString(me?.department);
  const positionName = resolveString(me?.position);
  const managerName = resolveManager(me?.manager);
  const jobTitle = me?.jobTitle ?? positionName;

  const dob = me?.birthdate
    ? (() => { try { return format(new Date(me.birthdate!), "MMM d, yyyy"); } catch { return null; } })()
    : null;

  const startDateFmt = me?.startDate
    ? (() => { try { return format(new Date(me.startDate!), "MMM d, yyyy"); } catch { return null; } })()
    : null;

  const addressLine1 = me?.addressStreet ?? null;
  const addressLine2 = [me?.addressCity, me?.addressState && me?.addressZip ? `${me.addressState} ${me.addressZip}` : (me?.addressState ?? me?.addressZip)].filter(Boolean).join(", ") || null;
  const addressDisplay = addressLine1
    ? (addressLine2 ? `${addressLine1}\n${addressLine2}` : addressLine1)
    : null;

  const payRateDisplay = me?.payRate != null && me?.payType
    ? formatPayRate(me.payRate, me.payType)
    : null;

  const compensationEffectiveDateFmt = me?.compensationEffectiveDate
    ? (() => { try { return format(new Date(me.compensationEffectiveDate!), "MMM d, yyyy"); } catch { return null; } })()
    : null;

  const hasEmergency =
    me?.emergencyContactName || me?.emergencyContactPhone || me?.emergencyContactRelation;

  return (
    <aside className="w-[260px] shrink-0 space-y-3">
      {/* QR Card */}
      <div className="bg-white rounded-xl border p-3 space-y-2">
        {isClockedIn && (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-green-700">
              Clocked IN{clockTime ? ` since ${clockTime}` : ""}
            </span>
          </div>
        )}

        {qrData?.employeeNumber && (
          <div className="text-center">
            <span className="font-mono text-[13px] font-bold tracking-widest text-slate-800">
              {String(qrData.employeeNumber).padStart(6, "0")}
            </span>
          </div>
        )}

        <div className="flex justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Your QR code" width={136} height={136} />
          ) : (
            <div className="w-[136px] h-[136px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              No QR code
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div>
          <p className="text-[12px] font-semibold leading-tight truncate">{fullName}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {jobTitle ?? ""}{jobTitle ? " · " : ""}PP Print
          </p>
        </div>

        {qrDataUrl && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleSaveQr}>Save</Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handlePrintQr}>Print</Button>
          </div>
        )}

        {/* Important dates trigger */}
        <div className="border-t pt-2 -mx-1 px-1">
          <ImportantDatesPanel />
        </div>
      </div>

      {/* Personal Info — 4 sub-sections with global privacy toggle */}
      <div className="bg-white rounded-xl border p-3">
        {/* Card header with eye toggle */}
        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
          <p className="text-[11px] font-semibold text-slate-700">My Information</p>
          <button
            onClick={() => setPersonalVisible((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={personalVisible ? "Hide all details" : "Show all details"}
            aria-label={personalVisible ? "Hide all details" : "Show all details"}
          >
            {personalVisible
              ? <Eye className="h-3.5 w-3.5" />
              : <EyeOff className="h-3.5 w-3.5" />
            }
          </button>
        </div>

        {personalVisible ? (
          <>
            {/* 1. Personal Details */}
            <SectionLabel label="Personal Details" first />
            <div className="space-y-1.5">
              <InfoRow label="Name" value={fullName} />
              <InfoRow label="DOB" value={dob} />
              <InfoRow label="Phone" value={me?.phone} />
              <InfoRow label="Personal" value={me?.personalEmail} />
              <InfoRow label="Work" value={me?.workEmail} />
              {addressDisplay ? (
                <div className="flex gap-1.5 items-start text-[11px]">
                  <span className="text-muted-foreground shrink-0 w-[68px]">Address</span>
                  <span className="font-medium leading-snug break-words min-w-0 flex-1 whitespace-pre-line">
                    {addressDisplay}
                  </span>
                </div>
              ) : (
                <InfoRow label="Address" value={null} />
              )}
            </div>

            {/* 2. Preferences */}
            <EmployeePreferencesSection
              data={{
                tshirtSize: me?.tshirtSize as TShirtSize | null | undefined,
                allergyInfo: me?.allergyInfo,
              }}
            />

            {/* 3. Employment */}
            <SectionLabel label="Employment" />
            <div className="space-y-1.5">
              <InfoRow label="Dept" value={deptName} />
              <InfoRow label="Title" value={jobTitle} />
              <InfoRow label="Type" value={EMPLOYMENT_TYPE_LABEL[me?.employmentType ?? ""] ?? me?.employmentType} />
              <InfoRow label="Start" value={startDateFmt} />
              <InfoRow label="Manager" value={managerName} />
            </div>

            {/* 4. Compensation */}
            <SectionLabel label="Compensation" />
            <div className="space-y-1.5">
              <div className="flex gap-1.5 items-start text-[11px]">
                <span className="text-muted-foreground shrink-0 w-[68px]">Pay type</span>
                <span className="font-medium leading-snug">
                  {me?.payType ? (me.payType === "HOURLY" ? "Hourly" : "Salary") : "—"}
                </span>
              </div>
              <div className="flex gap-1.5 items-start text-[11px]">
                <span className="text-muted-foreground shrink-0 w-[68px]">Pay rate</span>
                {payRateDisplay ? (
                  <span className="font-medium leading-snug">{payRateDisplay}</span>
                ) : (
                  <span className="leading-snug" style={{ color: "#d97706" }}>Not set</span>
                )}
              </div>
              <InfoRow
                label="Frequency"
                value={me?.payFrequency ? (PAY_FREQ_LABEL[me.payFrequency] ?? me.payFrequency) : null}
              />
              <InfoRow
                label="Overtime"
                value={
                  me?.isNonExempt != null
                    ? me.isNonExempt
                      ? "Eligible (Non-Exempt)"
                      : "Not eligible (Exempt)"
                    : me?.overtimeEligible != null
                      ? me.overtimeEligible
                        ? "Yes"
                        : "No"
                      : null
                }
              />
              <InfoRow label="Effective" value={compensationEffectiveDateFmt} />
            </div>

            {/* 5. Emergency Contact */}
            <SectionLabel label="Emergency Contact" />
            {hasEmergency ? (
              <div className="space-y-1.5">
                <InfoRow label="Name" value={me?.emergencyContactName} />
                <InfoRow label="Relation" value={me?.emergencyContactRelation} />
                <InfoRow label="Phone" value={me?.emergencyContactPhone} />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic text-center py-1">
                No emergency contact on file.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground italic text-center py-3">
            Information hidden — click <EyeOff className="inline h-3 w-3 mx-0.5" /> to show
          </p>
        )}
      </div>
    </aside>
  );
}
