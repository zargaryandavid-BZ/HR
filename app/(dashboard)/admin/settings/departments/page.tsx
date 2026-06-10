"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Department = {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
};

/** Department CRUD management page */
export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as Department[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/departments/${editing.id}` : "/api/departments";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setShowForm(false);
      setEditing(null);
      setName("");
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });

  function startEdit(dept: Department) {
    setEditing(dept);
    setName(dept.name);
    setDescription(dept.description ?? "");
    setShowForm(true);
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage organizational departments"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? "Edit Department" : "New Department"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !departments?.length ? (
        <EmptyState title="No departments" description="Create your first department to get started." />
      ) : (
        <DataTable>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employees</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-b">
                <td className="px-4 py-3 font-medium">{dept.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{dept.description ?? "—"}</td>
                <td className="px-4 py-3">{dept._count.employees}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(dept)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete ${dept.name}?`)) deleteMutation.mutate(dept.id);
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
