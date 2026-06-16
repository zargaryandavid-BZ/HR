"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, DataTable, EmptyState } from "@/components/shared/page-header";
import { RoleGate } from "@/components/shared/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatStoredDate } from "@/lib/dates";

type Holiday = {
  id: string;
  name: string;
  date: string;
  isPaid: boolean;
  isRecurringAnnually: boolean;
};

const IMPORT_YEARS = [2026, 2027, 2028, 2029, 2030] as const;

function toFormDateValue(date: string): string {
  return date.slice(0, 10);
}

/** Company holiday management page */
export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/holidays");
      const json = await res.json();
      return json.data as Holiday[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing
        ? `/api/settings/holidays/${editing.id}`
        : "/api/settings/holidays";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          isPaid,
          isRecurringAnnually: isRecurring,
          isCompanyWide: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      resetForm();
      showToast(editing ? "Holiday updated" : "Holiday created");
    },
    onError: () => showToast("Failed to save holiday"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/settings/holidays/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holidays"] }),
  });

  const importMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await fetch("/api/holidays/seed-federal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to import holidays");
      return { year, created: json.data.created as number };
    },
    onSuccess: ({ year, created }) => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      if (created === 0) {
        showToast(`Already imported for ${year}`);
      } else {
        showToast(`✓ Imported ${created} federal holidays for ${year}`);
      }
    },
    onError: () => showToast("Failed to import federal holidays"),
  });

  function resetForm() {
    setShowForm(false);
    setEditing(null);
    setName("");
    setDate("");
    setIsPaid(true);
    setIsRecurring(false);
  }

  function startEdit(holiday: Holiday) {
    setEditing(holiday);
    setName(holiday.name);
    setDate(toFormDateValue(holiday.date));
    setIsPaid(holiday.isPaid);
    setIsRecurring(holiday.isRecurringAnnually);
    setShowForm(true);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  return (
    <div>
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded-md border bg-background px-4 py-3 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <PageHeader
        title="Holidays"
        description="Manage company-wide holidays"
        actions={
          <div className="flex gap-2">
            <RoleGate allowedRoles={["SUPER_ADMIN", "HR_ADMIN"]}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={importMutation.isPending}>
                    <Download className="h-4 w-4 mr-2" />
                    Import Federal Holidays
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {IMPORT_YEARS.map((year) => (
                    <DropdownMenuItem
                      key={year}
                      onClick={() => importMutation.mutate(year)}
                    >
                      {year}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </RoleGate>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </div>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? "Edit Holiday" : "New Holiday"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Independence Day" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPaid} onCheckedChange={(c) => setIsPaid(!!c)} />
              Paid holiday
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isRecurring} onCheckedChange={(c) => setIsRecurring(!!c)} />
              Recurring annually
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!name || !date || saveMutation.isPending}
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
      ) : !holidays?.length ? (
        <EmptyState title="No holidays" description="Add company holidays to exclude from working days." />
      ) : (
        <DataTable>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paid</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recurring</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-b">
                <td className="px-4 py-3 font-medium">{h.name}</td>
                <td className="px-4 py-3">
                  {formatStoredDate(h.date, { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={h.isPaid ? "success" : "secondary"}>{h.isPaid ? "Paid" : "Unpaid"}</Badge>
                </td>
                <td className="px-4 py-3">{h.isRecurringAnnually ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <RoleGate allowedRoles={["SUPER_ADMIN", "HR_ADMIN"]}>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </RoleGate>
                    <RoleGate allowedRoles={["SUPER_ADMIN", "HR_ADMIN"]}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${h.name}?`)) deleteMutation.mutate(h.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </RoleGate>
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
