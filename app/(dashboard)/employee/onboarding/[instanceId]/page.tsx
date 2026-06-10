"use client";

import { use, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingWizard, type WizardStep } from "@/components/onboarding/onboarding-wizard";
import { formatEmployeeName } from "@/lib/utils";

type PageProps = { params: Promise<{ instanceId: string }> };

/** Employee-facing sequential onboarding wizard */
export default function EmployeeOnboardingPage({ params }: PageProps) {
  const { instanceId } = use(params);
  const queryClient = useQueryClient();

  const { data: instance, isLoading } = useQuery({
    queryKey: ["onboarding-wizard", instanceId],
    queryFn: async () => {
      const res = await fetch(`/api/onboarding/instances/${instanceId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
  });

  const steps = useMemo((): WizardStep[] => {
    if (!instance) return [];
    return instance.stepProgress.map(
      (p: {
        step: {
          id: string;
          title: string;
          description: string | null;
          stepType: WizardStep["stepType"];
          isRequired: boolean;
          config: Record<string, unknown>;
          sortOrder: number;
        };
        id: string;
        status: WizardStep["progress"]["status"];
        responseData: Record<string, unknown> | null;
      }) => ({
        ...p.step,
        progress: {
          id: p.id,
          status: p.status,
          responseData: p.responseData,
        },
      })
    );
  }, [instance]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!instance) {
    return <p>Onboarding not found.</p>;
  }

  const employeeName = formatEmployeeName(
    instance.employee.firstName,
    instance.employee.lastName,
    instance.employee.preferredName
  );
  const positionName =
    instance.employee.position?.name ?? instance.template.position.name;

  return (
    <OnboardingWizard
      employeeName={employeeName}
      positionName={positionName}
      steps={steps}
      instanceId={instanceId}
      isCompleted={instance.status === "COMPLETED"}
      completedMessage={
        <div className="max-w-lg mx-auto text-center py-16">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Congratulations!</h1>
          <p className="text-muted-foreground">
            You have completed your onboarding for {positionName}. HR has been notified.
          </p>
        </div>
      }
      onStepComplete={() =>
        queryClient.invalidateQueries({ queryKey: ["onboarding-wizard", instanceId] })
      }
    />
  );
}
