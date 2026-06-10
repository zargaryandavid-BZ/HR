"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FlowStep = {
  id: string;
  title: string;
  description: string | null;
  stepType: "FORM" | "DOCUMENT_SIGN" | "SURVEY" | "FILE_UPLOAD";
  sortOrder: number;
  isRequired: boolean;
  config: Record<string, unknown>;
};

const STEP_TYPE_LABELS: Record<FlowStep["stepType"], string> = {
  FORM: "Form",
  DOCUMENT_SIGN: "Document",
  SURVEY: "Survey",
  FILE_UPLOAD: "Upload",
};

type FlowStepCardProps = {
  step: FlowStep;
  index: number;
  onEdit?: (step: FlowStep) => void;
  onDelete?: (stepId: string) => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
  className?: string;
};

/** Presentational step card — used for sortable rows and drag overlay */
export function FlowStepCard({
  step,
  index,
  onEdit,
  onDelete,
  dragHandleProps,
  isDragging = false,
  isOverlay = false,
  className,
}: FlowStepCardProps) {
  return (
    <Card
      className={cn(
        "w-full",
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-lg ring-2 ring-primary/20 cursor-grabbing",
        className
      )}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:text-foreground touch-none",
            dragHandleProps ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          )}
          {...dragHandleProps}
          tabIndex={dragHandleProps ? 0 : -1}
          aria-hidden={!dragHandleProps}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{step.title}</p>
          {step.description && (
            <p className="text-xs text-muted-foreground truncate">{step.description}</p>
          )}
        </div>
        <Badge variant="outline">{STEP_TYPE_LABELS[step.stepType]}</Badge>
        {step.isRequired && <Badge variant="secondary">Required</Badge>}
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={() => onEdit(step)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(step.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type SortableStepCardProps = {
  step: FlowStep;
  index: number;
  onEdit: (step: FlowStep) => void;
  onDelete: (stepId: string) => void;
};

/** Draggable onboarding step card for the flow builder */
export function SortableStepCard({ step, index, onEdit, onDelete }: SortableStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FlowStepCard
        step={step}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
