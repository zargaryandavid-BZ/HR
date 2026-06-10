"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableStepCard, FlowStepCard, type FlowStep } from "@/components/onboarding/sortable-step-list";
import { StepBuilderModal } from "@/components/onboarding/step-builder-modal";

type PageProps = { params: Promise<{ positionId: string }> };

/** Stable signature so server step sync doesn't loop on new array references */
function buildStepsSignature(steps: FlowStep[]): string {
  return steps
    .map(
      (step) =>
        `${step.id}:${step.sortOrder}:${step.title}:${step.stepType}:${JSON.stringify(step.config)}`
    )
    .join("|");
}

/** Offboarding flow builder — configure automation steps */
export default function OnboardingFlowPage({ params }: PageProps) {
  const { positionId } = use(params);
  const queryClient = useQueryClient();
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [orderedSteps, setOrderedSteps] = useState<FlowStep[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["offboarding-flow", positionId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/positions/${positionId}/offboarding-flow`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as {
        position: { id: string; name: string; department: { name: string } | null };
        template: {
          id: string;
          steps: FlowStep[];
        } | null;
      };
    },
  });

  const serverStepsSignature = useMemo(
    () => (data?.template?.steps ? buildStepsSignature(data.template.steps) : ""),
    [data?.template?.steps]
  );

  useEffect(() => {
    const steps = data?.template?.steps;
    if (!steps) {
      setOrderedSteps((current) => (current.length === 0 ? current : []));
      return;
    }

    setOrderedSteps((current) => {
      if (buildStepsSignature(current) === serverStepsSignature) {
        return current;
      }
      return steps;
    });
  }, [serverStepsSignature]);

  const activeStep = activeStepId
    ? orderedSteps.find((step) => step.id === activeStepId)
    : null;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveStepMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      stepType: FlowStep["stepType"];
      isRequired: boolean;
      config: Record<string, unknown>;
    }) => {
      if (editingStep) {
        const res = await fetch(
          `/api/settings/positions/${positionId}/offboarding-flow/steps/${editingStep.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) throw new Error("Failed to update step");
      } else {
        const res = await fetch(
          `/api/settings/positions/${positionId}/offboarding-flow/steps`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) throw new Error("Failed to add step");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offboarding-flow", positionId] });
      setStepModalOpen(false);
      setEditingStep(null);
      setToast(editingStep ? "Step updated" : "Step added");
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(
        `/api/settings/positions/${positionId}/offboarding-flow/steps/${stepId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to delete");
    },
    onMutate: (stepId) => {
      const previous = orderedSteps;
      setOrderedSteps((steps) => steps.filter((step) => step.id !== stepId));
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offboarding-flow", positionId] });
      setToast("Step deleted");
    },
    onError: (error: Error, _stepId, context) => {
      if (context?.previous) setOrderedSteps(context.previous);
      setToast(error.message || "Failed to delete step");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (stepIds: string[]) => {
      const res = await fetch(
        `/api/settings/positions/${positionId}/offboarding-flow/steps`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIds }),
        }
      );
      if (!res.ok) throw new Error("Failed to reorder");
      return stepIds;
    },
    onSuccess: (stepIds) => {
      queryClient.setQueryData(
        ["offboarding-flow", positionId],
        (old: { template: { id: string; steps: FlowStep[] } | null } | undefined) => {
          if (!old?.template) return old;
          const stepMap = new Map(old.template.steps.map((step) => [step.id, step]));
          const reordered = stepIds
            .map((id, index) => {
              const step = stepMap.get(id);
              return step ? { ...step, sortOrder: index } : null;
            })
            .filter((step): step is FlowStep => step !== null);
          return {
            ...old,
            template: { ...old.template, steps: reordered },
          };
        }
      );
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveStepId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveStepId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedSteps.findIndex((s) => s.id === active.id);
    const newIndex = orderedSteps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = orderedSteps;
    const reordered = arrayMove(orderedSteps, oldIndex, newIndex);
    setOrderedSteps(reordered);

    reorderMutation.mutate(reordered.map((s) => s.id), {
      onError: () => {
        setOrderedSteps(previous);
        setToast("Failed to reorder steps");
      },
    });
  }

  function handleDragCancel() {
    setActiveStepId(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasAutomation = Boolean(data?.template);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/offboarding/automation" className="hover:underline">
          ← Offboarding
        </Link>
      </nav>

      <PageHeader
        title="Offboarding Flow"
        description="Configure offboarding document steps for employees leaving this position"
      />

      {!hasAutomation && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No automation exists for{" "}
          <span className="font-medium">{data?.position.name ?? "this position"}</span>.{" "}
          <Link href="/admin/offboarding/automation" className="font-medium underline">
            Create one from Offboarding Automation
          </Link>{" "}
          before adding steps.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps ({orderedSteps.length})</h2>
          <Button
            disabled={!hasAutomation}
            onClick={() => {
              setEditingStep(null);
              setStepModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={orderedSteps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {orderedSteps.map((step, index) => (
                <SortableStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  onEdit={(s) => {
                    setEditingStep(s);
                    setStepModalOpen(true);
                  }}
                  onDelete={(id) => {
                    if (confirm("Delete this step?")) deleteStepMutation.mutate(id);
                  }}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
            {activeStep ? (
              <FlowStepCard
                step={activeStep}
                index={orderedSteps.findIndex((s) => s.id === activeStep.id)}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {orderedSteps.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No steps yet. Add steps to build the offboarding flow.
          </p>
        )}
      </div>

      <StepBuilderModal
        open={stepModalOpen}
        onOpenChange={setStepModalOpen}
        step={editingStep}
        positionId={positionId}
        onSave={(payload) => saveStepMutation.mutate(payload)}
        isSaving={saveStepMutation.isPending}
      />

      <ToastBanner message={toast} variant="success" />
    </div>
  );
}
