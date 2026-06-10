"use client";

import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyScheduleBuilder } from "@/components/employees/weekly-schedule-builder";
import {
  getDefaultCustomSchedule,
  migrateLegacyFixedConfig,
  type CustomScheduleConfig,
} from "@/lib/schedule";
import { WORKING_DAYS, type EmployeeFormValues } from "@/lib/validations";

type ScheduleConfigFieldsProps = {
  form: UseFormReturn<EmployeeFormValues>;
  scheduleType: EmployeeFormValues["scheduleType"];
  weeklyScheduleFooter?: React.ReactNode;
};

/** Dynamic schedule configuration fields based on schedule type */
export function ScheduleConfigFields({
  form,
  scheduleType,
  weeklyScheduleFooter,
}: ScheduleConfigFieldsProps) {
  const { setValue, watch, formState } = form;
  const scheduleConfigError = formState.errors.scheduleConfig?.message as string | undefined;

  if (scheduleType === "FIXED") {
    const rawConfig = watch("scheduleConfig");
    const config: CustomScheduleConfig =
      rawConfig?.type === "CUSTOM"
        ? (rawConfig as CustomScheduleConfig)
        : migrateLegacyFixedConfig(rawConfig);

    return (
      <WeeklyScheduleBuilder
        value={config}
        onChange={(next) => setValue("scheduleConfig", next, { shouldValidate: true })}
        formError={scheduleConfigError}
        footer={weeklyScheduleFooter}
      />
    );
  }

  if (scheduleType === "SHIFT_BASED") {
    const workingDays = (watch("scheduleConfig") as { workingDays?: number[] })?.workingDays ?? [];

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Shift-Based Schedule</h4>
        <div className="space-y-2">
          <Label>Shift Template Name</Label>
          <Input
            placeholder="e.g. Morning Shift"
            onChange={(e) =>
              setValue("scheduleConfig", {
                type: "SHIFT_BASED",
                shiftTemplateName: e.target.value,
                workingDays,
              })
            }
            defaultValue={
              (watch("scheduleConfig") as { shiftTemplateName?: string })?.shiftTemplateName ?? ""
            }
          />
        </div>
        <WorkingDaysSelector
          selected={workingDays}
          onChange={(days) =>
            setValue("scheduleConfig", {
              type: "SHIFT_BASED",
              shiftTemplateName:
                (watch("scheduleConfig") as { shiftTemplateName?: string })?.shiftTemplateName ?? "",
              workingDays: days,
            })
          }
        />
      </div>
    );
  }

  if (scheduleType === "HOURS_BASED") {
    const config = watch("scheduleConfig") as {
      period?: "DAILY" | "WEEKLY";
      requiredHours?: number;
    };

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Hours-Based Schedule</h4>
        <div className="space-y-2">
          <Label>Period</Label>
          <Select
            value={config?.period ?? "DAILY"}
            onValueChange={(v: "DAILY" | "WEEKLY") =>
              setValue("scheduleConfig", {
                type: "HOURS_BASED",
                period: v,
                requiredHours: config?.requiredHours ?? 8,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Required hours per day</SelectItem>
              <SelectItem value="WEEKLY">Required hours per week</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Required Hours</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            onChange={(e) =>
              setValue("scheduleConfig", {
                type: "HOURS_BASED",
                period: config?.period ?? "DAILY",
                requiredHours: parseFloat(e.target.value) || 0,
              })
            }
            defaultValue={config?.requiredHours ?? 8}
          />
        </div>
      </div>
    );
  }

  if (scheduleType === "FLEXIBLE") {
    const config = watch("scheduleConfig") as { weeklyTargetHours?: number };

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Flexible Schedule</h4>
        <div className="space-y-2">
          <Label>Weekly Target Hours (optional)</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 40"
            onChange={(e) =>
              setValue("scheduleConfig", {
                type: "FLEXIBLE",
                weeklyTargetHours: parseFloat(e.target.value) || undefined,
              })
            }
            defaultValue={config?.weeklyTargetHours ?? ""}
          />
        </div>
      </div>
    );
  }

  return null;
}

/** Checkbox group for selecting working days of the week */
function WorkingDaysSelector({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Working Days</Label>
      <div className="flex flex-wrap gap-3">
        {WORKING_DAYS.map((day) => (
          <label key={day.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(day.value)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, day.value]);
                } else {
                  onChange(selected.filter((d) => d !== day.value));
                }
              }}
            />
            {day.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Initialize default schedule config when schedule type changes */
export function getDefaultScheduleConfig(
  scheduleType: EmployeeFormValues["scheduleType"]
): EmployeeFormValues["scheduleConfig"] {
  switch (scheduleType) {
    case "FIXED":
      return getDefaultCustomSchedule();
    case "SHIFT_BASED":
      return { type: "SHIFT_BASED", shiftTemplateName: "", workingDays: [1, 2, 3, 4, 5] };
    case "HOURS_BASED":
      return { type: "HOURS_BASED", period: "DAILY", requiredHours: 8 };
    case "FLEXIBLE":
      return { type: "FLEXIBLE", weeklyTargetHours: 40 };
  }
}

export { migrateLegacyFixedConfig };
