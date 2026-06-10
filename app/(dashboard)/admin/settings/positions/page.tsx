"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Workflow, Clock } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AccrualPolicyDialog } from "@/components/admin/settings/accrual-policy-dialog";

type Department = {
  id: string;
  name: string;
  _count: { employees: number; positions: number };
};

type Position = {
  id: string;
  name: string;
  description: string | null;
  departmentId?: string;
  department?: { id: string; name: string };
  isActive: boolean;
  _count: { employees: number };
  onboardingTemplates: { id: string; name: string; _count: { steps: number } }[];
};

/** Positions management page grouped by department */
export default function PositionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const [accrualPosition, setAccrualPosition] = useState<Position | null>(null);

  const { data: departments, isLoading: deptsLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as Department[];
    },
  });

  const activeDeptId = selectedDeptId ?? departments?.[0]?.id ?? null;

  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ["positions", activeDeptId],
    queryFn: async () => {
      const res = await fetch(
        `/api/settings/positions?departmentId=${activeDeptId}&includeInactive=true`
      );
      const json = await res.json();
      return json.data as Position[];
    },
    enabled: !!activeDeptId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/settings/positions/${editing.id}` : "/api/settings/positions";
      const method = editing ? "PATCH" : "POST";
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        departmentId,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to save position");
      }
      return {
        position: json.data as Position,
        isEdit: Boolean(editing),
        savedDepartmentId: departmentId,
      };
    },
    onSuccess: async ({ position, isEdit, savedDepartmentId }) => {
      setSelectedDeptId(savedDepartmentId);
      await queryClient.refetchQueries({ queryKey: ["positions", savedDepartmentId] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      queryClient.invalidateQueries({ queryKey: ["positions-for-documents"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setModalOpen(false);
      setEditing(null);
      setName("");
      setDescription("");
      setToastVariant("success");
      setToast(isEdit ? "Position updated" : `Position "${position.name}" created`);
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/positions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to deactivate");
      }
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["positions", activeDeptId] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setToastVariant("success");
      setToast("Position deactivated");
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (position: Position) => {
      const res = await fetch(`/api/settings/positions/${position.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to delete position");
      }
      return position.name;
    },
    onSuccess: async (positionName) => {
      await queryClient.refetchQueries({ queryKey: ["positions", activeDeptId] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["positions-all"] });
      queryClient.invalidateQueries({ queryKey: ["positions-for-documents"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setToastVariant("success");
      setToast(`Position "${positionName}" deleted`);
    },
    onError: (error: Error) => {
      setToastVariant("error");
      setToast(error.message);
    },
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setDepartmentId(activeDeptId ?? "");
    setModalOpen(true);
  }

  function openEdit(position: Position) {
    setEditing(position);
    setName(position.name);
    setDescription(position.description ?? "");
    setDepartmentId(position.departmentId ?? position.department?.id ?? activeDeptId ?? "");
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Manage job positions and their onboarding flows by department"
        actions={
          <Button onClick={openCreate} disabled={!activeDeptId}>
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-64 shrink-0">
          <CardHeader>
            <CardTitle className="text-base">Departments</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {deptsLoading ? (
              <Skeleton className="h-32 m-4" />
            ) : (
              <div className="flex flex-col">
                {departments?.map((dept) => {
                  const positionCount = dept._count?.positions ?? 0;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptId(dept.id)}
                      className={cn(
                        "px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent flex items-center justify-between gap-2",
                        activeDeptId === dept.id && "bg-primary/10 font-medium text-primary"
                      )}
                    >
                      <span className="truncate">{dept.name}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          activeDeptId === dept.id
                            ? "text-primary/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {positionCount} position{positionCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1 min-w-0">
          {positionsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !positions?.length ? (
            <EmptyState
              title="No positions"
              description="Add positions for this department to define job positions and onboarding flows."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {positions.map((position) => {
                const hasFlow = position.onboardingTemplates.length > 0;
                return (
                  <Card key={position.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{position.name}</h3>
                          <Badge variant={position.isActive ? "success" : "secondary"}>
                            {position.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={hasFlow ? "default" : "outline"}>
                            {hasFlow ? "Onboarding attached" : "No onboarding"}
                          </Badge>
                        </div>
                        {position.description && (
                          <p className="text-sm text-muted-foreground">{position.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {position._count.employees} employee
                          {position._count.employees === 1 ? "" : "s"} in this position
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(position)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        {position.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Deactivate "${position.name}"? It will be hidden from new assignments.`)) {
                                deactivateMutation.mutate(position.id);
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Permanently delete "${position.name}"? This cannot be undone.`
                              )
                            ) {
                              deleteMutation.mutate(position);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAccrualPosition(position)}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Accrual Policy
                        </Button>
                        {hasFlow ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/admin/settings/positions/${position.id}/onboarding-flow`
                              )
                            }
                          >
                            <Workflow className="h-4 w-4 mr-1" />
                            Edit Onboarding Flow
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/admin/onboarding/automation">
                              <Workflow className="h-4 w-4 mr-1" />
                              Create Automation
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Position" : "Add Position"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Position Name <span className="text-destructive">*</span>
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={departmentId || undefined}
                onValueChange={setDepartmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name || !departmentId || saveMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccrualPolicyDialog
        positionId={accrualPosition?.id ?? null}
        positionName={accrualPosition?.name ?? ""}
        open={!!accrualPosition}
        onOpenChange={(open) => !open && setAccrualPosition(null)}
      />

      <ToastBanner message={toast} variant={toastVariant} />
    </div>
  );
}
