"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewExperience } from "@/components/onboarding/onboarding-preview-experience";
import { ToastBanner } from "@/components/shared/toast-banner";
import type { FlowStep } from "@/components/onboarding/sortable-step-list";

type PageProps = { params: Promise<{ positionId: string }> };

/** Admin preview of the employee onboarding wizard — centered popup, no data saved */
export default function OnboardingFlowPreviewPage({ params }: PageProps) {
  const { positionId } = use(params);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-flow", positionId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/positions/${positionId}/onboarding-flow`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as {
        position: { id: string; name: string; department: { name: string } };
        template: {
          name: string;
          steps: FlowStep[];
        } | null;
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const position = data?.position;
  const steps = data?.template?.steps ?? [];

  if (steps.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/settings/positions/${positionId}/onboarding-flow`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Flow Builder
          </Link>
        </Button>
        <p className="text-center text-muted-foreground py-12">
          This flow has no steps yet. Add steps in the flow builder to preview them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <OnboardingPreviewExperience
        positionId={positionId}
        positionName={position?.name ?? "Position"}
        steps={steps}
        onPreviewAction={() => setToast("Preview mode — no data is saved")}
      />

      <ToastBanner message={toast} />
    </>
  );
}
