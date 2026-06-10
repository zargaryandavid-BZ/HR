"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OnboardingStepRenderer } from "@/components/onboarding/step-renderer";
import {
  advancePreviewStep,
  buildPreviewWizardSteps,
  type WizardStep,
} from "@/components/onboarding/onboarding-wizard";

type OnboardingPreviewExperienceProps = {
  positionId: string;
  positionName: string;
  steps: {
    id: string;
    title: string;
    description: string | null;
    stepType: WizardStep["stepType"];
    isRequired: boolean;
    config: Record<string, unknown>;
  }[];
  onPreviewAction?: () => void;
};

/** Centered popup preview of the employee onboarding wizard */
export function OnboardingPreviewExperience({
  positionId,
  positionName,
  steps,
  onPreviewAction,
}: OnboardingPreviewExperienceProps) {
  const [wizardSteps, setWizardSteps] = useState(() => buildPreviewWizardSteps(steps));

  const completedCount = wizardSteps.filter((s) => s.progress.status === "COMPLETED").length;
  const progressPercent = wizardSteps.length ? (completedCount / wizardSteps.length) * 100 : 0;
  const allComplete = wizardSteps.length > 0 && completedCount === wizardSteps.length;

  const activeStep = useMemo(() => {
    return (
      wizardSteps.find(
        (s) => s.progress.status === "AVAILABLE" || s.progress.status === "IN_PROGRESS"
      ) ?? null
    );
  }, [wizardSteps]);

  const activeStepIndex = activeStep
    ? wizardSteps.findIndex((s) => s.id === activeStep.id)
    : -1;

  function handleStepComplete() {
    if (!activeStep) return;
    setWizardSteps((current) => advancePreviewStep(current, activeStep.id));
    onPreviewAction?.();
  }

  function handleRestart() {
    setWizardSteps(buildPreviewWizardSteps(steps));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-dialog-title"
        className="relative flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Employee Preview
            </p>
            <h2 id="preview-dialog-title" className="text-lg font-semibold truncate">
              Preview Employee
            </h2>
            <p className="text-sm text-muted-foreground truncate">{positionName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            asChild
            aria-label="Exit preview"
          >
            <Link href={`/admin/settings/positions/${positionId}/onboarding-flow`}>
              <X className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-2 border-b px-6 py-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Step {allComplete ? wizardSteps.length : activeStepIndex + 1} of {wizardSteps.length}
            </span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {allComplete ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-green-600" />
              <h3 className="text-xl font-semibold mb-2">Onboarding complete</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You have previewed all {wizardSteps.length} steps. No data was saved.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={handleRestart}>
                  Restart Preview
                </Button>
                <Button asChild>
                  <Link href={`/admin/settings/positions/${positionId}/onboarding-flow`}>
                    Back to Flow Builder
                  </Link>
                </Button>
              </div>
            </div>
          ) : activeStep ? (
            <OnboardingStepRenderer
              key={activeStep.id}
              step={activeStep}
              previewMode
              onPreviewAction={onPreviewAction}
              onComplete={handleStepComplete}
            />
          ) : null}
        </div>

        {!allComplete && (
          <div className="border-t bg-muted/40 px-6 py-3">
            <p className="text-center text-xs text-muted-foreground">
              Preview mode — submit advances to the next step. No data is saved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
