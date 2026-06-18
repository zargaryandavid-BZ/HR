"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeFormSchema, buildEmployeeSectionPatchSchema, type EmployeeFormValues } from "@/lib/validations";
import {
  pickSectionPayload,
  stripEmptyStrings,
  getEmployeeTabSaveLabel,
  type EmployeeFormSection,
} from "@/lib/employees/form-sections";
import { normalizePhoneOnBlur, sanitizePhoneInput } from "@/lib/schedule";
import {
  ScheduleConfigFields,
  getDefaultScheduleConfig,
  migrateLegacyFixedConfig,
} from "@/components/employees/schedule-config-fields";
import { PersonalInfoFields } from "@/components/employees/personal-info-fields";
import { BreakScheduleSection } from "@/components/employees/break-schedule-section";
import type { TShirtSize } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ErrorMessage } from "@/components/shared/page-header";

const ALL_SECTIONS: EmployeeFormSection[] = [
  "contact",
  "employment",
  "personal",
  "schedule",
  "emergency",
];

type EmployeeFormProps = {
  defaultValues?: Partial<EmployeeFormValues>;
  employeeId?: string;
  onSuccess?: () => void;
  onToast?: (message: string) => void;
  tShirtSize?: TShirtSize | null;
  allergies?: string | null;
  /** When set, only render these sections (used on employee detail tabs) */
  sections?: EmployeeFormSection[];
  /** Show break schedule column beside weekly schedule on the Schedule tab */
  breakScheduleSettings?: {
    employeeId: string;
    scheduleRevision?: string;
    mealBreak1WaiverEnabled: boolean;
    mealBreak2WaiverEnabled: boolean;
    onSaved?: (message: string) => void;
    onError?: (message: string) => void;
  };
};

/** Required field label with red asterisk */
function RequiredLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

const POSITION_NONE = "__none__";

/** Radix Select requires undefined (not "") when no item is selected */
function toSelectValue(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function normalizeDefaultValues(
  values?: Partial<EmployeeFormValues>
): Partial<EmployeeFormValues> | undefined {
  if (!values) return values;
  if (values.scheduleType === "FIXED" && values.scheduleConfig) {
    return {
      ...values,
      scheduleConfig: migrateLegacyFixedConfig(values.scheduleConfig),
    };
  }
  return values;
}

/** Full employee create/edit form with dynamic schedule config */
export function EmployeeForm({
  defaultValues,
  employeeId,
  onSuccess,
  onToast,
  tShirtSize,
  allergies,
  sections,
  breakScheduleSettings,
}: EmployeeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!employeeId;
  const normalizedDefaults = useMemo(
    () => normalizeDefaultValues(defaultValues),
    [defaultValues]
  );
  const visibleSections = sections ?? ALL_SECTIONS;
  const show = (section: EmployeeFormSection) => visibleSections.includes(section);
  const isSectionedEdit = isEdit && !!sections;

  const validationSchema = useMemo(() => {
    if (!isSectionedEdit) return employeeFormSchema;
    const sectionSchema = buildEmployeeSectionPatchSchema(visibleSections);
    return sectionSchema;
  }, [isSectionedEdit, visibleSections]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(validationSchema) as unknown as Resolver<EmployeeFormValues>,
    defaultValues: {
      departmentId: "",
      positionId: "",
      jobTitle: "",
      addressCountry: "US",
      employmentType: "FULL_TIME",
      payType: "HOURLY",
      isNonExempt: true,
      scheduleType: "FIXED",
      scheduleConfig: getDefaultScheduleConfig("FIXED"),
      ...normalizedDefaults,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const scheduleType = watch("scheduleType");
  const scheduleConfig = watch("scheduleConfig");
  const departmentId = watch("departmentId");
  const positionId = watch("positionId");
  const isNonExempt = watch("isNonExempt") ?? true;

  useEffect(() => {
    if (!isEdit) {
      setValue("scheduleConfig", getDefaultScheduleConfig(scheduleType));
    }
  }, [scheduleType, isEdit, setValue]);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as { id: string; name: string }[];
    },
  });

  const {
    data: positions,
    isLoading: positionsLoading,
    isFetching: positionsFetching,
  } = useQuery({
    queryKey: ["positions", departmentId],
    queryFn: async () => {
      const res = await fetch(`/api/positions?departmentId=${departmentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load positions");
      return json.data as { id: string; name: string }[];
    },
    enabled: !!departmentId,
  });

  const loadingPositions = !!departmentId && (positionsLoading || positionsFetching);

  const { data: positionFlow } = useQuery({
    queryKey: ["position-flow", positionId],
    queryFn: async () => {
      const res = await fetch(`/api/onboarding/position-flow?positionId=${positionId}`);
      const json = await res.json();
      return json.data as { hasFlow: boolean; template: { stepCount: number } | null };
    },
    enabled: !!positionId,
  });

  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const res = await fetch("/api/employees/managers");
      const json = await res.json();
      return json.data as { id: string; name: string }[];
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Submit employee form to create or update API */
  async function onSubmit(data: EmployeeFormValues) {
    setSubmitError(null);

    const sectionData = isSectionedEdit
      ? stripEmptyStrings(pickSectionPayload(data, visibleSections))
      : data;
    const payload = { ...sectionData };

    // Explicit null clears position when HR chooses "None" (undefined is omitted from JSON)
    if (
      isSectionedEdit &&
      visibleSections.includes("employment") &&
      !data.positionId
    ) {
      (payload as { positionId?: string | null }).positionId = null;
    }

    const url = isEdit ? `/api/employees/${employeeId}` : "/api/employees";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      setSubmitError(json.error ?? json.message ?? "Failed to save employee");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["employees"] });
    await queryClient.invalidateQueries({ queryKey: ["employees-count"] });
    if (employeeId) {
      await queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
    }

    if (onSuccess) {
      onSuccess();
    } else if (!isEdit) {
      router.push("/admin/employees");
      router.refresh();
    }
  }

  const saveLabel = isSectionedEdit
    ? getEmployeeTabSaveLabel(visibleSections)
    : isEdit
      ? "Update Employee"
      : "Create Employee";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitError && <ErrorMessage message={submitError} />}

      {show("contact") && (
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <RequiredLabel htmlFor="firstName">First Name</RequiredLabel>
            <Input id="firstName" {...register("firstName")} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="lastName">Last Name</RequiredLabel>
            <Input id="lastName" {...register("lastName")} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred Name</Label>
            <Input id="preferredName" {...register("preferredName")} />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="workEmail">Work Email</RequiredLabel>
            <Input id="workEmail" type="email" {...register("workEmail")} />
            {errors.workEmail && (
              <p className="text-sm text-destructive">{errors.workEmail.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="personalEmail">Personal Email</Label>
            <Input id="personalEmail" type="email" {...register("personalEmail")} />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="phone">Phone</RequiredLabel>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              {...register("phone", {
                onChange: (e) => {
                  e.target.value = sanitizePhoneInput(e.target.value);
                },
                onBlur: (e) => {
                  const normalized = normalizePhoneOnBlur(e.target.value);
                  e.target.value = normalized;
                  setValue("phone", normalized, { shouldValidate: true });
                },
              })}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {show("employment") && (
      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <RequiredLabel>Department</RequiredLabel>
            <Controller
              name="departmentId"
              control={control}
              render={({ field }) => (
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue("positionId", undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.departmentId && (
              <p className="text-sm text-destructive">{errors.departmentId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <Controller
              name="positionId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? field.value : POSITION_NONE}
                  onValueChange={(value) => {
                    if (value === POSITION_NONE) {
                      field.onChange(undefined);
                      return;
                    }
                    field.onChange(value);
                    const position = positions?.find((p) => p.id === value);
                    if (position) {
                      setValue("jobTitle", position.name, { shouldValidate: true });
                    }
                  }}
                  disabled={!departmentId || loadingPositions}
                >
                  <SelectTrigger>
                    {loadingPositions ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading positions…
                      </span>
                    ) : (
                      <SelectValue
                        placeholder={
                          departmentId
                            ? "Select position (optional)"
                            : "Select department first"
                        }
                      />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={POSITION_NONE}>None</SelectItem>
                    {!loadingPositions && positions?.length === 0 && (
                      <SelectItem value="__no_positions__" disabled>
                        No positions found for this department — add one in Settings →
                        Positions
                      </SelectItem>
                    )}
                    {positions?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {positionId && positionFlow?.hasFlow && (
              <Badge variant="success" className="font-normal">
                ✓ Onboarding flow ready
              </Badge>
            )}
            {positionId && positionFlow && !positionFlow.hasFlow && (
              <p className="text-xs text-muted-foreground">No onboarding flow set</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="jobTitle">Job Title</RequiredLabel>
            <Input id="jobTitle" {...register("jobTitle")} />
            <p className="text-xs text-muted-foreground">
              Auto-filled from position. You can customize this.
            </p>
            {errors.jobTitle && (
              <p className="text-sm text-destructive">{errors.jobTitle.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel>Employment Type</RequiredLabel>
            <Controller
              name="employmentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full Time</SelectItem>
                    <SelectItem value="PART_TIME">Part Time</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.employmentType && (
              <p className="text-sm text-destructive">{errors.employmentType.message}</p>
            )}
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Controller
                name="payType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOURLY">Hourly</SelectItem>
                      <SelectItem value="SALARY">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Controller
                name="managerId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="startDate">Start Date</RequiredLabel>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-4 mt-2">
            <p className="text-sm font-semibold text-foreground mb-3">Employee Classification</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Non-Exempt Employee</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isNonExempt
                    ? "Overtime is calculated. Sick leave and PTO accrual apply."
                    : "Overtime is not calculated. Sick leave and PTO accrual still apply (California law)."}
                </p>
              </div>
              <Controller
                name="isNonExempt"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {show("personal") && (
      <PersonalInfoFields
        register={register}
        control={control}
        watch={watch}
        errors={errors}
        employeeId={employeeId}
        onToast={onToast}
        tShirtSize={tShirtSize}
        allergies={allergies}
      />
      )}

      {show("schedule") && (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Controller
              name="scheduleType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="SHIFT_BASED">Shift Based</SelectItem>
                    <SelectItem value="HOURS_BASED">Hours Based</SelectItem>
                    <SelectItem value="FLEXIBLE">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {breakScheduleSettings ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="min-w-0">
                <ScheduleConfigFields
                  form={form}
                  scheduleType={scheduleType}
                  weeklyScheduleFooter={
                    scheduleType === "FIXED" ? (
                      <Button type="submit" size="sm" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : saveLabel}
                      </Button>
                    ) : undefined
                  }
                />
                {scheduleType !== "FIXED" && (
                  <Button type="submit" size="sm" disabled={isSubmitting} className="mt-4">
                    {isSubmitting ? "Saving..." : saveLabel}
                  </Button>
                )}
              </div>
              <div className="min-w-0">
                <BreakScheduleSection
                  employeeId={breakScheduleSettings.employeeId}
                  scheduleType={scheduleType}
                  scheduleRevision={breakScheduleSettings.scheduleRevision}
                  mealBreak1WaiverEnabled={breakScheduleSettings.mealBreak1WaiverEnabled}
                  mealBreak2WaiverEnabled={breakScheduleSettings.mealBreak2WaiverEnabled}
                  onSaved={breakScheduleSettings.onSaved}
                  onError={breakScheduleSettings.onError}
                  className="h-full"
                />
              </div>
            </div>
          ) : (
            <ScheduleConfigFields form={form} scheduleType={scheduleType} />
          )}
        </CardContent>
      </Card>
      )}

      {show("emergency") && (
      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <RequiredLabel htmlFor="emergencyContactName">Name</RequiredLabel>
            <Input id="emergencyContactName" {...register("emergencyContactName")} />
            {errors.emergencyContactName && (
              <p className="text-sm text-destructive">{errors.emergencyContactName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="emergencyContactPhone">Phone</RequiredLabel>
            <Input
              id="emergencyContactPhone"
              type="tel"
              inputMode="tel"
              {...register("emergencyContactPhone", {
                onChange: (e) => {
                  e.target.value = sanitizePhoneInput(e.target.value);
                },
                onBlur: (e) => {
                  const normalized = normalizePhoneOnBlur(e.target.value);
                  e.target.value = normalized;
                  setValue("emergencyContactPhone", normalized, { shouldValidate: true });
                },
              })}
            />
            {errors.emergencyContactPhone && (
              <p className="text-sm text-destructive">{errors.emergencyContactPhone.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="emergencyContactRelation">Relation</RequiredLabel>
            <Input id="emergencyContactRelation" {...register("emergencyContactRelation")} />
            {errors.emergencyContactRelation && (
              <p className="text-sm text-destructive">{errors.emergencyContactRelation.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {!breakScheduleSettings && (
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : saveLabel}
          </Button>
          {!sections && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
