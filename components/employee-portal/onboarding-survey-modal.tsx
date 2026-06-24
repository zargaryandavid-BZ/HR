"use client";

import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import type { SurveyQuestionConfig, SurveyStepConfig } from "@/lib/onboarding/types";
import type { OnboardingTaskStep } from "@/lib/onboarding/task-types";
import { extractSavedValues } from "@/lib/onboarding/task-types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";

type OnboardingSurveyModalProps = {
  step: OnboardingTaskStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDraft: (responseData: Record<string, string>) => Promise<void>;
  onSubmit: (responseData: Record<string, string>) => Promise<void>;
  submitting?: boolean;
};

type SurveyBodyProps = {
  step: OnboardingTaskStep;
  onSaveDraft: (responseData: Record<string, string>) => Promise<void>;
  onSubmit: (responseData: Record<string, string>) => Promise<void>;
  submitting: boolean;
  onClose: () => void;
};

/** Survey fields — remounted when step changes so useForm initializes cleanly */
function OnboardingSurveyBody({
  step,
  onSaveDraft,
  onSubmit,
  submitting,
  onClose,
}: SurveyBodyProps) {
  const config = step.config as SurveyStepConfig;
  const questions = config.questions ?? [];
  const isReadOnly = step.status === "COMPLETED";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveDraftRef = useRef(onSaveDraft);
  const skipAutoSaveRef = useRef(true);

  onSaveDraftRef.current = onSaveDraft;

  const defaultValues = extractSavedValues(
    step.responseData,
    questions.map((question) => ({ id: question.id, label: question.question }))
  ) as Record<string, string>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<Record<string, string>>({ defaultValues });

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
        void onSaveDraftRef.current(values as Record<string, string>);
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
        <DialogDescription>Complete this survey as part of your onboarding</DialogDescription>
      </DialogHeader>

      {isReadOnly && step.completedAt && (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Submitted on {formatDisplayDate(step.completedAt)}. Contact HR to make
          changes.
        </div>
      )}

      <form onSubmit={handleSubmit((data) => void onSubmit(data))} className="space-y-4">
        {questions.map((question: SurveyQuestionConfig) => (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.question}
              {question.required && <span className="text-destructive"> *</span>}
            </Label>
            {question.answerType === "paragraph" ? (
              <Textarea
                disabled={isReadOnly}
                {...register(question.id, { required: question.required })}
              />
            ) : question.answerType === "multiple_choice" ? (
              <Controller
                name={question.id}
                control={control}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : question.answerType === "yes_no" ? (
              <Controller
                name={question.id}
                control={control}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
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
            ) : question.answerType === "rating" ? (
              <Controller
                name={question.id}
                control={control}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Rate 1–5" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <Input
                disabled={isReadOnly}
                {...register(question.id, { required: question.required })}
              />
            )}
            {errors[question.id] && (
              <p className="text-sm text-destructive">This question is required</p>
            )}
          </div>
        ))}

        {!isReadOnly && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseAttempt}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit answers"}
            </Button>
          </DialogFooter>
        )}
      </form>
    </>
  );
}

/** Modal for completing or viewing a SURVEY onboarding step */
export function OnboardingSurveyModal({
  step,
  open,
  onOpenChange,
  onSaveDraft,
  onSubmit,
  submitting = false,
}: OnboardingSurveyModalProps) {
  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <OnboardingSurveyBody
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
