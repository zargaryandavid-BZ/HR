"use client";

import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import type { FormFieldConfig, FormStepConfig } from "@/lib/onboarding/types";
import { extractSavedValues } from "@/lib/onboarding/task-types";
import type { OnboardingTaskStep } from "@/lib/onboarding/task-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";

type OnboardingFormModalProps = {
  step: OnboardingTaskStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDraft: (responseData: Record<string, string | boolean>) => Promise<void>;
  onSubmit: (responseData: Record<string, string | boolean>) => Promise<void>;
  submitting?: boolean;
};

type FormBodyProps = {
  step: OnboardingTaskStep;
  onSaveDraft: (responseData: Record<string, string | boolean>) => Promise<void>;
  onSubmit: (responseData: Record<string, string | boolean>) => Promise<void>;
  submitting: boolean;
  onClose: () => void;
};

/** Form fields — remounted when step changes so useForm initializes cleanly */
function OnboardingFormBody({
  step,
  onSaveDraft,
  onSubmit,
  submitting,
  onClose,
}: FormBodyProps) {
  const config = step.config as FormStepConfig;
  const fields = config.fields ?? [];
  const isReadOnly = step.status === "COMPLETED";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveDraftRef = useRef(onSaveDraft);
  const skipAutoSaveRef = useRef(true);

  onSaveDraftRef.current = onSaveDraft;

  const defaultValues = extractSavedValues(step.responseData, fields);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<Record<string, string | boolean>>({ defaultValues });

  useEffect(() => {
    skipAutoSaveRef.current = true;
    const timer = window.setTimeout(() => {
      skipAutoSaveRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step.progressId]);

  useEffect(() => {
    if (isReadOnly) return;

    const subscription = watch((values) => {
      if (skipAutoSaveRef.current || !isDirty) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void onSaveDraftRef.current(values as Record<string, string | boolean>);
      }, 2000);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watch, isReadOnly, isDirty, step.progressId]);

  function handleCloseAttempt() {
    if (isDirty && !isReadOnly) {
      const confirmed = window.confirm("You have unsaved changes. Close anyway?");
      if (!confirmed) return;
    }
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{step.title}</DialogTitle>
        <DialogDescription>Complete this form as part of your onboarding</DialogDescription>
      </DialogHeader>

      {isReadOnly && step.completedAt && (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Submitted on {formatDisplayDate(step.completedAt)}. Contact HR to make
          changes.
        </div>
      )}

      <form
        onSubmit={handleSubmit((data) => void onSubmit(data as Record<string, string | boolean>))}
        className="space-y-4"
      >
        {fields.map((field: FormFieldConfig) => (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.type === "dropdown" ? (
              <Controller
                name={field.id}
                control={control}
                rules={{ required: field.required }}
                render={({ field: f }) => (
                  <Select
                    value={String(f.value ?? "")}
                    onValueChange={f.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder ?? "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : field.type === "checkbox" ? (
              <Controller
                name={field.id}
                control={control}
                render={({ field: f }) => (
                  <Checkbox
                    checked={!!f.value}
                    onCheckedChange={f.onChange}
                    disabled={isReadOnly}
                  />
                )}
              />
            ) : field.type === "yes_no" ? (
              <Controller
                name={field.id}
                control={control}
                rules={{ required: field.required }}
                render={({ field: f }) => (
                  <Select
                    value={String(f.value ?? "")}
                    onValueChange={f.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <Input
                type={
                  field.type === "number"
                    ? "number"
                    : field.type === "date"
                      ? "date"
                      : field.type === "email"
                        ? "email"
                        : field.type === "phone"
                          ? "tel"
                          : "text"
                }
                placeholder={field.placeholder}
                disabled={isReadOnly}
                {...register(field.id, { required: field.required })}
              />
            )}
            {errors[field.id] && (
              <p className="text-sm text-destructive">This field is required</p>
            )}
          </div>
        ))}

        {!isReadOnly && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseAttempt}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        )}
      </form>
    </>
  );
}

/** Modal for completing or viewing a FORM onboarding step */
export function OnboardingFormModal({
  step,
  open,
  onOpenChange,
  onSaveDraft,
  onSubmit,
  submitting = false,
}: OnboardingFormModalProps) {
  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <OnboardingFormBody
          key={step.progressId}
          step={step}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
          submitting={submitting}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
