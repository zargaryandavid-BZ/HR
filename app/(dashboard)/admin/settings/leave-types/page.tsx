"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type LeaveType = {
  id: string;
  name: string;
  defaultDays: number;
  accrualType: string;
  isPaid: boolean;
};

/** Leave type CRUD management page */
export default function LeaveTypesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [defaultDays, setDefaultDays] = useState(10);
  const [accrualType, setAccrualType] = useState<"LUMP_SUM" | "ACCRUED">("LUMP_SUM");
  const [isPaid, setIsPaid] = useState(true);

  const { data: leaveTypes, isLoading } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/leave-types");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load leave types");
      return json.data as LeaveType[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing
        ? `/api/settings/leave-types/${editing.id}`
        : "/api/settings/leave-types";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, defaultDays, accrualType, isPaid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/leave-types/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-types"] }),
  });

  function resetForm() {
    setShowForm(false);
    setEditing(null);
    setName("");
    setDefaultDays(10);
    setAccrualType("LUMP_SUM");
    setIsPaid(true);
  }

  function startEdit(lt: LeaveType) {
    setEditing(lt);
    setName(lt.name);
    setDefaultDays(lt.defaultDays);
    setAccrualType(lt.accrualType as "LUMP_SUM" | "ACCRUED");
    setIsPaid(lt.isPaid);
    setShowForm(true);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  return (
    <div>
      <PageHeader
        title="Leave Types"
        description="Configure leave categories and default allowances"
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Leave Type
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? "Edit Leave Type" : "New Leave Type"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PTO" />
            </div>
            <div className="space-y-2">
              <Label>Default Days</Label>
              <Input
                type="number"
                value={defaultDays}
                onChange={(e) => setDefaultDays(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Accrual Type</Label>
              <Select value={accrualType} onValueChange={(v: "LUMP_SUM" | "ACCRUED") => setAccrualType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LUMP_SUM">Lump Sum</SelectItem>
                  <SelectItem value="ACCRUED">Accrued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPaid} onCheckedChange={(c) => setIsPaid(!!c)} />
              Paid leave
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!name || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !leaveTypes?.length ? (
        <EmptyState title="No leave types" description="Add leave types like PTO, Sick Leave, etc." />
      ) : (
        <DataTable>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Default Days</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Accrual</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.map((lt) => (
              <tr key={lt.id} className="border-b">
                <td className="px-4 py-3 font-medium">{lt.name}</td>
                <td className="px-4 py-3">{lt.defaultDays}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{lt.accrualType.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3">{lt.isPaid ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(lt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete ${lt.name}?`)) deleteMutation.mutate(lt.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
