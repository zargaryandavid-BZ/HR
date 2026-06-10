"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AvailableDocument = {
  id: string;
  title: string;
  documentType: string;
  scope: "COMPANY_WIDE" | "POSITION_SPECIFIC";
  version: number;
};

type AssignOffboardingDocumentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (message: string) => void;
};

/** Modal for HR to manually assign repository documents to an employee */
export function AssignOffboardingDocumentModal({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: AssignOffboardingDocumentModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["available-offboarding-documents", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/available-offboarding?employeeId=${employeeId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to load documents");
      return json.data as AvailableDocument[];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents ?? [];
    return (documents ?? []).filter((doc) => doc.title.toLowerCase().includes(q));
  }, [documents, search]);

  const assignMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const res = await fetch(`/api/employees/${employeeId}/offboarding-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to assign documents");
      return json.data as { assigned: number; skipped: number };
    },
    onSuccess: (result) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["employee-offboarding-docs", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["available-offboarding-documents", employeeId] });
      onOpenChange(false);
      setSelected(new Set());
      setSearch("");
      onSuccess(
        result.assigned > 0
          ? `${result.assigned} document${result.assigned !== 1 ? "s" : ""} added — click "Send for Signature" when ready`
          : "No new documents were assigned"
      );
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function toggleDoc(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(new Set());
      setSearch("");
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Offboarding Documents to {employeeName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Select documents to add. Already-assigned docs are not shown.
        </p>

        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex-1 overflow-y-auto min-h-[200px] border rounded-md">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading documents...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              All repository documents are already assigned.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((doc) => {
                const checked = selected.has(doc.id);
                return (
                  <li key={doc.id}>
                    <label
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50",
                        checked && "bg-primary/5"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDoc(doc.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DocumentTypeBadge type={doc.documentType as DocumentType} />
                          <span className="font-medium text-sm truncate">{doc.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.scope === "COMPANY_WIDE" ? "Co. wide" : "Pos."} · v{doc.version}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || assignMutation.isPending}
            onClick={() => assignMutation.mutate([...selected])}
          >
            {assignMutation.isPending
              ? "Assigning..."
              : `Assign selected (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
