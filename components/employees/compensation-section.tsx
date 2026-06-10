"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import type { Control, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { EmployeeFormValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type HistoryRecord = {
  id: string;
  previousRate: number | null;
  newRate: number;
  payType: "HOURLY" | "SALARY";
  effectiveDate: string;
  changedBy: string;
  note: string | null;
};

const PAY_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  SEMI_MONTHLY: "Semi-monthly (1st & 15th)",
  MONTHLY: "Monthly",
};

/** Format a pay rate for display */
function formatRate(rate: number, payType: "HOURLY" | "SALARY"): string {
  if (payType === "HOURLY") return `$${rate.toFixed(2)} / hr`;
  return `$${Math.round(rate).toLocaleString("en-US")} / yr`;
}

/** Compensation history collapsible panel */
function CompensationHistory({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ["compensation-history", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/compensation-history`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load history");
      return json.data as HistoryRecord[];
    },
    enabled: open,
  });

  const hasNotes = history?.some((r) => r.note);

  return (
    <div className="pt-2 border-t">
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {open ? "Hide history" : "Show compensation history"}
      </button>

      {open && (
        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground">No compensation history yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Change</th>
                    <th className="px-3 py-2 text-left font-medium">Pay Type</th>
                    <th className="px-3 py-2 text-left font-medium">Changed By</th>
                    {hasNotes && (
                      <th className="px-3 py-2 text-left font-medium">Note</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">{r.effectiveDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.previousRate == null
                          ? `— → ${formatRate(r.newRate, r.payType)} (initial rate)`
                          : `${formatRate(r.previousRate, r.payType)} → ${formatRate(r.newRate, r.payType)}`}
                      </td>
                      <td className="px-3 py-2">
                        {r.payType === "HOURLY" ? "Hourly" : "Salary"}
                      </td>
                      <td className="px-3 py-2">{r.changedBy}</td>
                      {hasNotes && (
                        <td className="px-3 py-2 text-muted-foreground">{r.note ?? "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type CompensationSectionProps = {
  employeeId: string;
  /** Whether the viewer can edit (HR Admin / Super Admin only) */
  canEdit: boolean;
  control: Control<EmployeeFormValues>;
  watch: UseFormWatch<EmployeeFormValues>;
  setValue: UseFormSetValue<EmployeeFormValues>;
  /** Current pay type from the Employment Details section */
  payType: "HOURLY" | "SALARY";
  /** Current saved values to display when in read-only mode */
  savedPayRate?: number | null;
  savedPayFrequency?: string | null;
  savedOvertimeEligible?: boolean;
  savedEffectiveDate?: string | null;
};

/** Compensation card rendered inside the Profile tab (HR-only section) */
export function CompensationSection({
  employeeId,
  canEdit,
  control,
  watch,
  setValue,
  payType,
  savedPayRate,
  savedPayFrequency,
  savedOvertimeEligible,
}: CompensationSectionProps) {
  const overtimeEligible = watch("overtimeEligible") ?? savedOvertimeEligible ?? true;
  const payRateValue = watch("payRate");
  const rateUnit = payType === "HOURLY" ? "/ hour" : "/ year";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Compensation</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Visible to HR Admin and Super Admin only
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {canEdit ? (
          /* ── Edit mode ─────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pay Rate */}
            <div className="space-y-2">
              <Label htmlFor="payRate">Pay Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="payRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="flex-1"
                  {...{
                    value: payRateValue ?? "",
                    onChange: (e) => {
                      const v = e.target.value;
                      setValue("payRate", v === "" ? undefined : Number(v));
                    },
                  }}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                  {rateUnit}
                </span>
              </div>
            </div>

            {/* Pay Frequency */}
            <div className="space-y-2">
              <Label>Pay Frequency</Label>
              <Controller
                name="payFrequency"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                      <SelectItem value="SEMI_MONTHLY">Semi-monthly (1st &amp; 15th)</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Rate Effective Date */}
            <div className="space-y-2">
              <Label htmlFor="compensationEffectiveDate">Rate Effective Date</Label>
              <Controller
                name="compensationEffectiveDate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="compensationEffectiveDate"
                    type="date"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                  />
                )}
              />
            </div>

            {/* Overtime Eligible */}
            <div className="space-y-2">
              <Label>Overtime Eligible</Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={overtimeEligible}
                  onCheckedChange={(v) => setValue("overtimeEligible", v)}
                />
                <span className="text-sm">
                  {overtimeEligible ? "Eligible" : "Exempt"}
                </span>
              </div>
              {!overtimeEligible && (
                <p className="text-xs text-muted-foreground">
                  This employee is exempt from overtime calculations
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Read-only mode (Manager) ───────────────── */
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Pay Rate</p>
              <p className="font-medium">
                {savedPayRate != null
                  ? formatRate(savedPayRate, payType)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Pay Frequency</p>
              <p className="font-medium">
                {savedPayFrequency
                  ? (PAY_FREQUENCY_LABELS[savedPayFrequency] ?? savedPayFrequency)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Overtime Eligible</p>
              <p className="font-medium">
                {savedOvertimeEligible !== false ? "Yes" : "No (exempt)"}
              </p>
            </div>
          </div>
        )}

        <CompensationHistory employeeId={employeeId} />
      </CardContent>
    </Card>
  );
}
