"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { companySettingsSchema } from "@/lib/validations";
import type { z } from "zod";

type SettingsForm = z.infer<typeof companySettingsSchema>;

/** Company-wide settings configuration page */
export default function CompanySettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company");
      const json = await res.json();
      return json.data as SettingsForm;
    },
  });

  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsForm>({
    resolver: zodResolver(companySettingsSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-settings"] }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (settings && !watch("overtimeThresholdHours")) {
    reset(settings);
  }

  return (
    <div>
      <PageHeader title="Company Settings" description="Configure company-wide HR policies" />
      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4 max-w-md"
          >
            <div className="space-y-2">
              <Label>Overtime Threshold (hours/week)</Label>
              <Input
                type="number"
                step="0.5"
                {...register("overtimeThresholdHours", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Coverage Warning (%)</Label>
              <Input
                type="number"
                {...register("coverageWarningPercent", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Late Threshold (minutes)</Label>
              <Input
                type="number"
                {...register("lateThresholdMinutes", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Year-End Rollover Policy</Label>
              <Select
                value={watch("yearEndRolloverPolicy") ?? settings?.yearEndRolloverPolicy}
                onValueChange={(v: SettingsForm["yearEndRolloverPolicy"]) =>
                  setValue("yearEndRolloverPolicy", v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CARRY_OVER">Carry Over</SelectItem>
                  <SelectItem value="EXPIRE">Expire</SelectItem>
                  <SelectItem value="CASH_OUT">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="location-requirement-toggle">Require Location for Clock In/Out</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, employees must be in an approved location zone to clock in, out, and manage breaks.
                </p>
              </div>
              <Switch
                id="location-requirement-toggle"
                checked={watch("locationRequirementEnabled") ?? settings?.locationRequirementEnabled ?? true}
                onCheckedChange={(checked) => setValue("locationRequirementEnabled", checked)}
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
