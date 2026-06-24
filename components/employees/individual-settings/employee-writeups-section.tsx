"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { WriteUpCategory } from "@prisma/client";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  WRITEUP_CATEGORY_BADGE_CLASSES,
  WRITEUP_CATEGORY_LABELS,
  type WriteUpItem,
} from "@/lib/individual-settings/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AddWriteUpSheet } from "./add-writeup-sheet";

/** Tab badge — shows when employee has not acknowledged write-ups */
export function WriteUpsPendingBadge({ employeeId }: { employeeId: string }) {
  const { data: writeUps } = useQuery({
    queryKey: ["employee-writeups", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/writeups`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load write-ups");
      return json.data as WriteUpItem[];
    },
  });

  const pendingCount = (writeUps ?? []).filter((w) => !w.acknowledgedAt).length;
  if (pendingCount === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`${pendingCount} write-up${pendingCount !== 1 ? "s" : ""} awaiting employee acknowledgment`}
    >
      <AlertCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
        {pendingCount}
      </span>
    </span>
  );
}

type EmployeeWriteUpsSectionProps = {
  employeeId: string;
  mode: "admin" | "employee";
  onToast?: (message: string) => void;
};

/** Disciplinary write-ups section for individual settings */
export function EmployeeWriteUpsSection({
  employeeId,
  mode,
  onToast,
}: EmployeeWriteUpsSectionProps) {
  const queryClient = useQueryClient();
  const { role } = useCurrentUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWriteUp, setEditingWriteUp] = useState<WriteUpItem | null>(null);

  const canAdd = mode === "admin" && ["HR_ADMIN", "SUPER_ADMIN"].includes(role ?? "");
  const canEdit = mode === "admin" && ["HR_ADMIN", "SUPER_ADMIN"].includes(role ?? "");
  const canDelete = mode === "admin" && role === "SUPER_ADMIN";

  const { data: writeUps, isLoading } = useQuery({
    queryKey: ["employee-writeups", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/writeups`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load write-ups");
      return json.data as WriteUpItem[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (writeupId: string) => {
      const res = await fetch(
        `/api/employees/${employeeId}/writeups/${writeupId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-writeups", employeeId] });
      onToast?.("Write-up deleted");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Disciplinary Write-ups</h2>
        {canAdd && (
          <Button
            size="sm"
            onClick={() => {
              setEditingWriteUp(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Write-up
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !writeUps?.length ? (
        <p className="text-sm text-muted-foreground">
          No disciplinary write-ups on record.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium w-[88px]">#</th>
                <th className="px-3 py-2 text-left font-medium w-[110px]">Category</th>
                <th className="px-3 py-2 text-left font-medium w-[100px]">Date</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium w-[160px]">Acknowledged</th>
                {mode === "admin" && (canEdit || canDelete) && (
                  <th className="px-3 py-2 text-right font-medium w-[88px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {writeUps.map((writeUp) => (
                <WriteUpRow
                  key={writeUp.id}
                  writeUp={writeUp}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  showActions={mode === "admin" && (canEdit || canDelete)}
                  onEdit={() => {
                    setEditingWriteUp(writeUp);
                    setSheetOpen(true);
                  }}
                  onDelete={() => {
                    if (confirm("Delete this write-up permanently?")) {
                      deleteMutation.mutate(writeUp.id);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAdd && (
        <AddWriteUpSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setEditingWriteUp(null);
          }}
          employeeId={employeeId}
          editWriteUp={editingWriteUp}
          onSuccess={(message) => {
            void queryClient.invalidateQueries({
              queryKey: ["employee-writeups", employeeId],
            });
            setEditingWriteUp(null);
            onToast?.(message);
          }}
        />
      )}
    </section>
  );
}

function WriteUpRow({
  writeUp,
  canEdit,
  canDelete,
  showActions,
  onEdit,
  onDelete,
}: {
  writeUp: WriteUpItem;
  canEdit: boolean;
  canDelete: boolean;
  showActions: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = writeUp.category as WriteUpCategory;
  const summary = [
    writeUp.description,
    writeUp.consequence ? `Action: ${writeUp.consequence}` : null,
    `Issued by ${writeUp.issuedByName}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr className="align-middle">
      <td className="px-3 py-2 font-medium whitespace-nowrap">#{writeUp.number}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            WRITEUP_CATEGORY_BADGE_CLASSES[category]
          )}
        >
          {WRITEUP_CATEGORY_LABELS[category]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {formatDisplayDate(writeUp.date)}
      </td>
      <td className="px-3 py-2 max-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {writeUp.attachmentUrl && (
            <a
              href={writeUp.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary hover:text-primary/80"
              title="View attachment"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <p className="truncate text-sm" title={summary}>
            {summary}
          </p>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {writeUp.acknowledgedAt ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800"
            title={`Acknowledged ${formatDisplayDate(writeUp.acknowledgedAt)}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Acknowledged — {formatDisplayDate(writeUp.acknowledgedAt)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Pending
          </span>
        )}
      </td>
      {showActions && (
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-0.5">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                title="Delete"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
