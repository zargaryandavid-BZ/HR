"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingTaskStep, OnboardingTasksPayload } from "@/lib/onboarding/task-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmployeeDashboardSection } from "./employee-dashboard-section";
import { OnboardingFormModal } from "./onboarding-form-modal";
import { OnboardingSurveyModal } from "./onboarding-survey-modal";
import { OnboardingUploadModal } from "./onboarding-upload-modal";

const TYPE_BADGE: Record<string, string> = {
  FORM: "bg-blue-100 text-blue-800 border-blue-200",
  FILE_UPLOAD: "bg-purple-100 text-purple-800 border-purple-200",
  SURVEY: "bg-teal-100 text-teal-800 border-teal-200",
};

const TYPE_LABEL: Record<string, string> = {
  FORM: "Form",
  FILE_UPLOAD: "Upload",
  SURVEY: "Survey",
};

function StatusChip({ step }: { step: OnboardingTaskStep }) {
  if (step.status === "COMPLETED") {
    return (
      <div className="text-right">
        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed
        </span>
        {step.completedAt && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {format(new Date(step.completedAt), "MM/dd/yy")}
          </p>
        )}
      </div>
    );
  }

  if (step.status === "LOCKED") {
    return <span className="text-xs text-muted-foreground">Locked</span>;
  }

  if (step.status === "IN_PROGRESS") {
    return <span className="text-xs text-blue-700 font-medium">In progress</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Action needed
    </span>
  );
}

/** Onboarding tasks table for the employee dashboard */
export function EmployeeOnboardingTasksSection() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<OnboardingTaskStep | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isLoading } = useQuery<OnboardingTasksPayload>({
    queryKey: ["employee-onboarding-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/employee/onboarding-tasks");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load tasks");
      return json.data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee-onboarding-tasks"] });

  const saveDraftMutation = useMutation({
    mutationFn: async ({
      progressId,
      responseData,
    }: {
      progressId: string;
      responseData: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/employee/onboarding-tasks/${progressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", responseData }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      progressId,
      responseData,
    }: {
      progressId: string;
      responseData: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/employee/onboarding-tasks/${progressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to submit");
      return json.data as OnboardingTasksPayload;
    },
    onSuccess: () => {
      void invalidate();
      setFormOpen(false);
      setSurveyOpen(false);
      toast.success("Task completed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      progressId,
      file,
      replace,
    }: {
      progressId: string;
      file: File;
      replace: boolean;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (replace) formData.append("replace", "true");
      const res = await fetch(`/api/employee/onboarding-tasks/${progressId}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Upload failed");
    },
    onSuccess: () => {
      void invalidate();
      toast.success("File uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Skeleton className="h-36 w-full" />;

  const steps = data?.steps ?? [];
  if (steps.length === 0) return null;

  const completedCount = data?.completedCount ?? 0;
  const allComplete = completedCount === steps.length;

  function openStep(step: OnboardingTaskStep) {
    setActiveStep(step);
    if (step.stepType === "FORM") setFormOpen(true);
    if (step.stepType === "SURVEY") setSurveyOpen(true);
    if (step.stepType === "FILE_UPLOAD") setUploadOpen(true);
  }

  function renderAction(step: OnboardingTaskStep) {
    if (step.status === "LOCKED") return null;

    if (step.status === "COMPLETED") {
      if (step.stepType === "FILE_UPLOAD") {
        const url = step.uploadedFileUrl ?? (step.responseData?.fileUrl as string | undefined);
        return url ? (
          <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              View file
            </a>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openStep(step)}>
            View file
          </Button>
        );
      }

      return (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openStep(step)}>
          {step.stepType === "SURVEY" ? "View answers" : "View submission"}
        </Button>
      );
    }

    if (step.stepType === "FORM") {
      return (
        <Button size="sm" className="text-xs h-7" onClick={() => openStep(step)}>
          Fill out →
        </Button>
      );
    }

    if (step.stepType === "SURVEY") {
      return (
        <Button size="sm" className="text-xs h-7" onClick={() => openStep(step)}>
          Start survey →
        </Button>
      );
    }

    return (
      <Button size="sm" className="text-xs h-7" onClick={() => openStep(step)}>
        Upload file →
      </Button>
    );
  }

  return (
    <>
      <EmployeeDashboardSection
        id="onboarding-tasks"
        title="Onboarding Tasks"
        actions={
          allComplete ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All tasks complete
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {completedCount} of {steps.length} completed
            </span>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium w-10">#</th>
                <th className="pb-2 text-left font-medium">Task</th>
                <th className="pb-2 text-left font-medium w-20">Required</th>
                <th className="pb-2 text-left font-medium w-24">Status</th>
                <th className="pb-2 text-right font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {steps.map((step) => (
                <tr
                  key={step.progressId}
                  className={cn(step.status === "LOCKED" && "opacity-60")}
                >
                  <td className="py-3 text-muted-foreground">{step.sortOrder}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{step.title}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          TYPE_BADGE[step.stepType] ?? "bg-gray-100 text-gray-800"
                        )}
                      >
                        {TYPE_LABEL[step.stepType] ?? step.stepType}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        step.isRequired
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      )}
                    >
                      {step.isRequired ? "Required" : "Optional"}
                    </span>
                  </td>
                  <td className="py-3">
                    <StatusChip step={step} />
                  </td>
                  <td className="py-3 text-right">{renderAction(step)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EmployeeDashboardSection>

      <OnboardingFormModal
        step={activeStep?.stepType === "FORM" ? activeStep : null}
        open={formOpen}
        onOpenChange={setFormOpen}
        submitting={submitMutation.isPending}
        onSaveDraft={async (responseData) => {
          if (!activeStep) return;
          await saveDraftMutation.mutateAsync({
            progressId: activeStep.progressId,
            responseData,
          });
        }}
        onSubmit={async (responseData) => {
          if (!activeStep) return;
          await submitMutation.mutateAsync({
            progressId: activeStep.progressId,
            responseData,
          });
        }}
      />

      <OnboardingSurveyModal
        step={activeStep?.stepType === "SURVEY" ? activeStep : null}
        open={surveyOpen}
        onOpenChange={setSurveyOpen}
        submitting={submitMutation.isPending}
        onSaveDraft={async (responseData) => {
          if (!activeStep) return;
          await saveDraftMutation.mutateAsync({
            progressId: activeStep.progressId,
            responseData,
          });
        }}
        onSubmit={async (responseData) => {
          if (!activeStep) return;
          await submitMutation.mutateAsync({
            progressId: activeStep.progressId,
            responseData,
          });
        }}
      />

      <OnboardingUploadModal
        step={activeStep?.stepType === "FILE_UPLOAD" ? activeStep : null}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        uploading={uploadMutation.isPending}
        onUpload={async (file, replace) => {
          if (!activeStep) return;
          await uploadMutation.mutateAsync({
            progressId: activeStep.progressId,
            file,
            replace,
          });
        }}
      />
    </>
  );
}

/** Amber banner shown when onboarding tasks need attention */
export function OnboardingTasksBanner() {
  const { data } = useQuery<OnboardingTasksPayload>({
    queryKey: ["employee-onboarding-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/employee/onboarding-tasks");
      const json = await res.json();
      return json.data;
    },
  });

  const pendingCount = data?.pendingCount ?? 0;
  if (!pendingCount) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
      <span>
        You have {pendingCount} onboarding task{pendingCount !== 1 ? "s" : ""} that need your
        attention.
      </span>
      <a href="#onboarding-tasks" className="text-amber-800 font-medium hover:underline text-xs">
        Complete tasks →
      </a>
    </div>
  );
}
