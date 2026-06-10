"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, Lock, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingStepRenderer } from "@/components/onboarding/step-renderer";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description: string | null;
  stepType: "FORM" | "DOCUMENT_SIGN" | "SURVEY" | "FILE_UPLOAD";
  isRequired: boolean;
  config: Record<string, unknown>;
  progress: {
    id: string;
    status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
    responseData: Record<string, unknown> | null;
  };
};

type OnboardingWizardProps = {
  employeeName: string;
  positionName: string;
  steps: WizardStep[];
  instanceId?: string;
  previewMode?: boolean;
  onPreviewAction?: () => void;
  onStepComplete?: () => void;
  completedMessage?: React.ReactNode;
  isCompleted?: boolean;
};

/** Shared employee onboarding wizard — supports live instance and admin preview modes */
export function OnboardingWizard({
  employeeName,
  positionName,
  steps,
  instanceId,
  previewMode = false,
  onPreviewAction,
  onStepComplete,
  completedMessage,
  isCompleted = false,
}: OnboardingWizardProps) {
  const completedCount = steps.filter((s) => s.progress.status === "COMPLETED").length;

  const activeStep = useMemo(() => {
    return (
      steps.find(
        (s) => s.progress.status === "AVAILABLE" || s.progress.status === "IN_PROGRESS"
      ) ?? steps.find((s) => s.progress.status === "LOCKED")
    );
  }, [steps]);

  if (isCompleted && completedMessage) {
    return <>{completedMessage}</>;
  }

  const progressPercent = steps.length ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-72 shrink-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{employeeName}</CardTitle>
            <p className="text-sm text-muted-foreground">{positionName}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>
                  {completedCount} of {steps.length} complete
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
            <ol className="space-y-2">
              {steps.map((step, idx) => {
                const status = step.progress.status;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "flex items-start gap-2 text-sm",
                      status === "LOCKED" && "text-muted-foreground",
                      (status === "AVAILABLE" || status === "IN_PROGRESS") &&
                        "text-primary font-medium",
                      status === "COMPLETED" && "text-green-700"
                    )}
                  >
                    {status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : status === "LOCKED" ? (
                      <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : status === "IN_PROGRESS" ? (
                      <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-pulse" />
                    ) : (
                      <Circle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>
                      {idx + 1}. {step.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </aside>

      <div className="flex-1 min-w-0">
        {activeStep ? (
          <OnboardingStepRenderer
            step={activeStep}
            instanceId={instanceId}
            previewMode={previewMode}
            onPreviewAction={onPreviewAction}
            onComplete={onStepComplete}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              All steps completed.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Build preview wizard steps — step 1 available, rest locked */
export function buildPreviewWizardSteps(
  steps: {
    id: string;
    title: string;
    description: string | null;
    stepType: WizardStep["stepType"];
    isRequired: boolean;
    config: Record<string, unknown>;
  }[]
): WizardStep[] {
  return steps.map((step, index) => ({
    ...step,
    progress: {
      id: `preview-${step.id}`,
      status: index === 0 ? "AVAILABLE" : "LOCKED",
      responseData: null,
    },
  }));
}

/** Mark a preview step complete and unlock the next one */
export function advancePreviewStep(steps: WizardStep[], completedStepId: string): WizardStep[] {
  const completedIndex = steps.findIndex((step) => step.id === completedStepId);
  if (completedIndex === -1) return steps;

  return steps.map((step, index) => {
    if (step.id === completedStepId) {
      return {
        ...step,
        progress: { ...step.progress, status: "COMPLETED" as const },
      };
    }
    if (index === completedIndex + 1 && step.progress.status === "LOCKED") {
      return {
        ...step,
        progress: { ...step.progress, status: "AVAILABLE" as const },
      };
    }
    return step;
  });
}
