"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Position = {
  id: string;
  name: string;
  isActive: boolean;
  department: { id: string; name: string } | null;
  offboardingTemplate: { id: string } | null;
};

type Automation = {
  id: string;
  name: string;
  position: {
    id: string;
    name: string;
    isActive: boolean;
    department: { id: string; name: string } | null;
  };
  _count: { steps: number };
};

/** Offboarding Automation page — manually created flows only */
export default function OffboardingAutomationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [duplicateSource, setDuplicateSource] = useState<Automation | null>(null);
  const [duplicateTargetId, setDuplicateTargetId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");

  const { data: automations, isLoading } = useQuery({
    queryKey: ["offboarding-automations"],
    queryFn: async () => {
      const res = await fetch("/api/offboarding/templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load automations");
      return json.data as Automation[];
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["positions-all"],
    queryFn: async () => {
      const res = await fetch("/api/settings/positions?includeInactive=true");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load positions");
      return json.data as Position[];
    },
  });

  const positionsWithoutAutomation =
    positions?.filter((p) => p.isActive && !p.offboardingTemplate) ?? [];

  const createMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const res = await fetch(`/api/settings/positions/${positionId}/offboarding-flow`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to create automation");
      }
      return positionId;
    },
    onSuccess: async (positionId) => {
      await queryClient.invalidateQueries({ queryKey: ["offboarding-automations"] });
      await queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      setCreateDialogOpen(false);
      setSelectedPositionId("");
      router.push(`/admin/settings/positions/${positionId}/offboarding-flow`);
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const res = await fetch(`/api/settings/positions/${positionId}/offboarding-flow`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to delete automation");
      }
      return json.message as string;
    },
    onSuccess: async (message) => {
      await queryClient.invalidateQueries({ queryKey: ["offboarding-automations"] });
      await queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      setToastVariant("success");
      setToast(message ?? "Automation deleted");
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({
      sourcePositionId,
      targetPositionId,
    }: {
      sourcePositionId: string;
      targetPositionId: string;
    }) => {
      const res = await fetch(
        `/api/settings/positions/${sourcePositionId}/offboarding-flow/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetPositionId }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to duplicate automation");
      }
      return json.message as string;
    },
    onSuccess: async (message) => {
      await queryClient.invalidateQueries({ queryKey: ["offboarding-automations"] });
      await queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      setDuplicateDialogOpen(false);
      setDuplicateSource(null);
      setDuplicateTargetId("");
      setToastVariant("success");
      setToast(message ?? "Automation duplicated");
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  /** Group positions by department for pickers */
  function groupByDepartment(list: Position[]): Map<string, Position[]> {
    const map = new Map<string, Position[]>();
    for (const p of list) {
      const label = p.department?.name ?? "No Department";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(p);
    }
    return map;
  }

  function openDuplicate(automation: Automation) {
    setDuplicateSource(automation);
    setDuplicateTargetId("");
    setDuplicateDialogOpen(true);
  }

  function handleDelete(automation: Automation) {
    const stepCount = automation._count.steps;
    const confirmed = confirm(
      `Delete the "${automation.position.name}" automation? This removes all ${stepCount} step${stepCount === 1 ? "" : "s"} and cannot be undone.`
    );
    if (confirmed) {
      deleteMutation.mutate(automation.position.id);
    }
  }

  const availableForDuplicate = positionsWithoutAutomation.filter(
    (p) => p.id !== duplicateSource?.position.id
  );
  const duplicateGroups = groupByDepartment(availableForDuplicate);
  const createGroups = groupByDepartment(positionsWithoutAutomation);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offboarding Automation"
        description="Set up document checklists for each position when an employee leaves"
        actions={
          <Button
            onClick={() => {
              setSelectedPositionId("");
              setCreateDialogOpen(true);
            }}
            disabled={isLoading || positionsWithoutAutomation.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">
        Automations are not created automatically. Use{" "}
        <strong>Create Automation</strong> to assign a checklist to a position. Manage positions in{" "}
        <Link
          href="/admin/settings/positions"
          className="text-primary hover:underline font-medium"
        >
          Settings → Positions
        </Link>
        .
      </p>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !automations?.length ? (
        <EmptyState
          title="No automations yet"
          description="Create your first position-based automation by selecting a position."
          action={
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={positionsWithoutAutomation.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              deleting={deleteMutation.isPending}
              onEdit={(positionId) =>
                router.push(`/admin/settings/positions/${positionId}/offboarding-flow`)
              }
              onDuplicate={openDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Position-Based Automation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select a position. The automation will be named after that position and apply to all
              new hires in that role. You can add steps after creation.
            </p>

            {positionsWithoutAutomation.length === 0 ? (
              <p className="text-sm text-amber-700">
                All active positions already have an automation.
              </p>
            ) : (
              <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a position…" />
                </SelectTrigger>
                <SelectContent>
                  {[...createGroups.entries()].map(([dept, deptPositions]) => (
                    <SelectGroup key={dept}>
                      <SelectLabel>{dept}</SelectLabel>
                      {deptPositions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedPositionId || createMutation.isPending}
              onClick={() => createMutation.mutate(selectedPositionId)}
            >
              Create &amp; Add Steps →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Automation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Copy{" "}
              <span className="font-medium text-foreground">
                {duplicateSource?.position.name}
              </span>{" "}
              ({duplicateSource?._count.steps ?? 0} steps) to another position.
            </p>

            {availableForDuplicate.length === 0 ? (
              <p className="text-sm text-amber-700">
                No positions available — all active positions already have an automation.
              </p>
            ) : (
              <Select value={duplicateTargetId} onValueChange={setDuplicateTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target position…" />
                </SelectTrigger>
                <SelectContent>
                  {[...duplicateGroups.entries()].map(([dept, deptPositions]) => (
                    <SelectGroup key={dept}>
                      <SelectLabel>{dept}</SelectLabel>
                      {deptPositions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!duplicateTargetId || duplicateMutation.isPending}
              onClick={() => {
                if (!duplicateSource) return;
                duplicateMutation.mutate({
                  sourcePositionId: duplicateSource.position.id,
                  targetPositionId: duplicateTargetId,
                });
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastBanner message={toast} variant={toastVariant} />
    </div>
  );
}

function AutomationCard({
  automation,
  deleting,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  automation: Automation;
  deleting: boolean;
  onEdit: (positionId: string) => void;
  onDuplicate: (automation: Automation) => void;
  onDelete: (automation: Automation) => void;
}) {
  const stepCount = automation._count.steps;

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{automation.position.name}</h3>
            <Badge variant="outline">Position-based</Badge>
            {automation.position.department && (
              <span className="text-sm text-muted-foreground">
                {automation.position.department.name}
              </span>
            )}
            {!automation.position.isActive && (
              <Badge variant="secondary">Inactive position</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {stepCount} step{stepCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" onClick={() => onEdit(automation.position.id)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDuplicate(automation)}>
            <Copy className="h-4 w-4 mr-1.5" />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            disabled={deleting}
            onClick={() => onDelete(automation)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
