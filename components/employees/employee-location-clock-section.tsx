"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type EmployeeLocationClockSectionProps = {
  employeeId: string;
  locationRequirementEnabled: boolean | null;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
};

/** Per-employee clock in/out location requirement (overrides company default when set) */
export function EmployeeLocationClockSection({
  employeeId,
  locationRequirementEnabled,
  onSaved,
  onError,
}: EmployeeLocationClockSectionProps) {
  const queryClient = useQueryClient();

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load company settings");
      return json.data as { locationRequirementEnabled: boolean };
    },
  });

  const companyDefault = companySettings?.locationRequirementEnabled ?? true;
  const effectiveRequired = locationRequirementEnabled ?? companyDefault;
  const hasOverride = locationRequirementEnabled !== null && locationRequirementEnabled !== undefined;

  const [enabled, setEnabled] = useState(effectiveRequired);

  useEffect(() => {
    setEnabled(effectiveRequired);
  }, [effectiveRequired]);

  const usingCompanyDefault = useMemo(
    () => !hasOverride,
    [hasOverride]
  );

  const saveMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationRequirementEnabled: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to save location setting");
      }
    },
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      onSaved?.(
        value
          ? "Location required for this employee's clock in/out"
          : "Location not required for this employee's clock in/out"
      );
    },
    onError: (err: Error) => {
      setEnabled(effectiveRequired);
      onError?.(err.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationRequirementEnabled: null }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to reset location setting");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      onSaved?.("Using company default for location requirement");
    },
    onError: (err: Error) => onError?.(err.message),
  });

  function handleToggle(checked: boolean) {
    if (!companyDefault && checked) {
      onError?.("Enable company-wide location requirement in Settings → Location Zones first");
      return;
    }
    setEnabled(checked);
    saveMutation.mutate(checked);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clock In/Out Location</CardTitle>
        <p className="text-sm text-muted-foreground">
          Control whether this employee must be at an approved location to clock in, out, and
          manage breaks.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!companyDefault && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Company-wide location requirement is currently disabled. No employees require location
            until it is enabled in Settings → Location Zones.
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor={`location-requirement-${employeeId}`}>
              Require location for clock in/out
            </Label>
            <p className="text-xs text-muted-foreground">
              {usingCompanyDefault
                ? `Using company default (${companyDefault ? "required" : "not required"})`
                : enabled
                  ? "Required for this employee"
                  : "Not required for this employee"}
            </p>
          </div>
          <Switch
            id={`location-requirement-${employeeId}`}
            checked={enabled}
            disabled={saveMutation.isPending || !companyDefault}
            onCheckedChange={handleToggle}
          />
        </div>

        {hasOverride && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            Use company default
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
