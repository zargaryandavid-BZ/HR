"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const compensationSchema = z.object({
  payRate: z.coerce.number().nonnegative("Pay rate must be 0 or more").optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
  compensationEffectiveDate: z.string().optional(),
});

type CompensationValues = z.infer<typeof compensationSchema>;

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

/** Format a rate value for display */
function formatRate(rate: number, payType: "HOURLY" | "SALARY"): string {
  if (payType === "HOURLY") return `$${rate.toFixed(2)} / hr`;
  return `$${Math.round(rate).toLocaleString("en-US")} / yr`;
}

/** Collapsible compensation history table */
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
    <div className="pt-3 border-t">
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

type CompensationFormProps = {
  employeeId: string;
  /** HR_ADMIN / SUPER_ADMIN → edit; MANAGER → read-only; EMPLOYEE → hidden (don't render) */
  viewerRole: "HR_ADMIN" | "SUPER_ADMIN" | "MANAGER";
  payType: "HOURLY" | "SALARY";
  savedPayRate?: number | null;
  savedPayFrequency?: string | null;
  isNonExempt?: boolean;
  savedEffectiveDate?: string | null;
  onToast?: (message: string) => void;
};

/** Standalone compensation form card — separate submit from the main profile form */
export function CompensationForm({
  employeeId,
  viewerRole,
  payType,
  savedPayRate,
  savedPayFrequency,
  isNonExempt = true,
  savedEffectiveDate,
  onToast,
}: CompensationFormProps) {
  const queryClient = useQueryClient();
  const canEdit = viewerRole === "HR_ADMIN" || viewerRole === "SUPER_ADMIN";
  const rateUnit = payType === "HOURLY" ? "/ hour" : "/ year";

  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } =
    useForm<CompensationValues>({
      resolver: zodResolver(compensationSchema) as never,
      defaultValues: {
        payRate: savedPayRate ?? undefined,
        payFrequency: (savedPayFrequency as CompensationValues["payFrequency"]) ?? undefined,
        compensationEffectiveDate: savedEffectiveDate ?? undefined,
      },
    });

  const saveMutation = useMutation({
    mutationFn: async (values: CompensationValues) => {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save compensation");
      return json.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      await queryClient.invalidateQueries({ queryKey: ["compensation-history", employeeId] });
      onToast?.("Compensation saved");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

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
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v as CompensationValues))} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pay Rate */}
              <div className="space-y-2">
                <Label htmlFor="comp-payRate">Pay Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="comp-payRate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="flex-1"
                    {...register("payRate")}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                    {rateUnit}
                  </span>
                </div>
                {errors.payRate && (
                  <p className="text-sm text-destructive">{errors.payRate.message}</p>
                )}
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
                <Label htmlFor="comp-effectiveDate">Rate Effective Date</Label>
                <Input
                  id="comp-effectiveDate"
                  type="date"
                  {...register("compensationEffectiveDate")}
                />
              </div>

              {/* Overtime Eligible — driven by Employment Details classification */}
              <div className="space-y-2">
                <Label>Overtime Eligible</Label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {isNonExempt ? (
                    <Badge variant="success">Eligible (Non-Exempt)</Badge>
                  ) : (
                    <Badge variant="secondary">Not Eligible (Exempt)</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Set in Employment Details → Classification
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || isSubmitting || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save Compensation"}
            </Button>
          </form>
        ) : (
          /* ── Read-only (Manager) ────────────────────────── */
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Pay Rate</p>
              <p className="font-medium">
                {savedPayRate != null ? formatRate(savedPayRate, payType) : "—"}
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
              <p className="font-medium">{isNonExempt ? "Yes (Non-Exempt)" : "No (Exempt)"}</p>
            </div>
          </div>
        )}

        <CompensationHistory employeeId={employeeId} />
      </CardContent>
    </Card>
  );
}
