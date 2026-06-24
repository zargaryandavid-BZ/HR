"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { CheckCircle2 } from "lucide-react";
import type { OnboardingTaskStep, OnboardingTasksPayload } from "@/lib/onboarding/task-types";
import { flattenResponseEntries } from "@/lib/onboarding/task-types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  FORM: "Form",
  FILE_UPLOAD: "Upload",
  SURVEY: "Survey",
  DOCUMENT_SIGN: "Document",
};

const TYPE_BADGE: Record<string, string> = {
  FORM: "bg-blue-100 text-blue-800 border-blue-200",
  FILE_UPLOAD: "bg-purple-100 text-purple-800 border-purple-200",
  SURVEY: "bg-teal-100 text-teal-800 border-teal-200",
  DOCUMENT_SIGN: "bg-amber-100 text-amber-800 border-amber-200",
};

type EmployeeOnboardingProgressSectionProps = {
  employeeId: string;
};

/** HR view of an employee's onboarding step progress */
export function EmployeeOnboardingProgressSection({
  employeeId,
}: EmployeeOnboardingProgressSectionProps) {
  const [viewStep, setViewStep] = useState<OnboardingTaskStep | null>(null);

  const { data, isLoading } = useQuery<OnboardingTasksPayload>({
    queryKey: ["employee-onboarding-progress", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/onboarding-progress`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load progress");
      return json.data;
    },
  });

  if (isLoading) return <Skeleton className="h-36 w-full" />;

  const steps = data?.steps ?? [];
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No onboarding instance found for this employee.
      </p>
    );
  }

  const entries = flattenResponseEntries(viewStep?.responseData ?? null);

  return (
    <>
      <section>
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Onboarding Steps</h2>
          <span className="text-xs text-muted-foreground">
            {data?.completedCount ?? 0} of {steps.length} completed
            {data?.instanceStatus ? ` · ${data.instanceStatus.replace("_", " ")}` : ""}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-3 py-2 text-left font-medium w-24">Type</th>
                <th className="px-3 py-2 text-left font-medium w-20">Required</th>
                <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                <th className="px-3 py-2 text-left font-medium w-28">Completed</th>
                <th className="px-3 py-2 text-left font-medium w-28">Response</th>
                <th className="px-3 py-2 text-left font-medium w-24">File</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {steps.map((step) => (
                <tr key={step.progressId}>
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {step.sortOrder}. {step.title}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        TYPE_BADGE[step.stepType]
                      )}
                    >
                      {TYPE_LABEL[step.stepType]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{step.isRequired ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-xs">
                    {step.status === "COMPLETED" ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </span>
                    ) : (
                      step.status.replace("_", " ")
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {step.completedAt
                      ? formatDisplayDate(step.completedAt)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {(step.stepType === "FORM" || step.stepType === "SURVEY") &&
                    step.responseData ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setViewStep(step)}
                      >
                        View answers
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {step.stepType === "FILE_UPLOAD" && step.uploadedFileUrl ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <a href={step.uploadedFileUrl} target="_blank" rel="noopener noreferrer">
                          View file
                        </a>
                      </Button>
                    ) : step.stepType === "DOCUMENT_SIGN" ? (
                      <span className="text-xs text-muted-foreground">See Onboarding Docs</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!viewStep} onOpenChange={(open) => !open && setViewStep(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewStep?.title}</DialogTitle>
          </DialogHeader>
          <dl className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.label} className="grid grid-cols-[1fr_1.2fr] gap-2 text-sm">
                <dt className="text-muted-foreground">{entry.label}</dt>
                <dd className="font-medium">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
