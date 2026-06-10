"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  ID_DOC_TYPE_BADGE_STYLES,
  ID_DOC_TYPE_LABELS,
} from "@/lib/identity-documents/constants";
import { getExpiryStatus } from "@/lib/identity-documents/expiry";
import type { IdentityDocumentDto } from "@/lib/identity-documents/service";
import { IdentityDocumentModal } from "./identity-document-modal";

type EmployeeIdentityDocumentsSectionProps = {
  employeeId: string;
  onToast?: (message: string) => void;
  /** Render inside Home Address card without an outer Card wrapper */
  embedded?: boolean;
};

function truncateNotes(notes: string | null, max = 40): string {
  if (!notes?.trim()) return "—";
  const trimmed = notes.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** HR Admin section for managing employee identity documents */
export function EmployeeIdentityDocumentsSection({
  employeeId,
  onToast,
  embedded = false,
}: EmployeeIdentityDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const { role } = useCurrentUser();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<IdentityDocumentDto | null>(null);

  const { data: documents, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["employee-identity-documents", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/identity-documents`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to load identity documents");
      }
      return json.data as IdentityDocumentDto[];
    },
  });

  function openAdd() {
    setEditingDoc(null);
    setModalOpen(true);
  }

  function openEdit(doc: IdentityDocumentDto) {
    setEditingDoc(doc);
    setModalOpen(true);
  }

  async function handleDelete(doc: IdentityDocumentDto) {
    if (
      !confirm(
        `Delete this ${ID_DOC_TYPE_LABELS[doc.docType]} record? This cannot be undone.`
      )
    ) {
      return;
    }

    const res = await fetch(
      `/api/employees/${employeeId}/identity-documents/${doc.id}`,
      { method: "DELETE" }
    );
    const json = await res.json();
    if (!res.ok) {
      onToast?.(json.message ?? "Failed to delete document");
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["employee-identity-documents", employeeId],
    });
    onToast?.("Identity document deleted");
  }

  function handleSuccess(message: string) {
    queryClient.invalidateQueries({
      queryKey: ["employee-identity-documents", employeeId],
    });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    onToast?.(message);
  }

  const canDelete = role === "SUPER_ADMIN";

  const header = (
    <div className="flex flex-row items-center justify-between gap-3 pb-4">
      <h3 className="text-base font-semibold">Identity Documents</h3>
      <Button size="sm" onClick={openAdd}>
        <Plus className="h-4 w-4 mr-1" />
        Add document
      </Button>
    </div>
  );

  const body = isLoading ? (
    <Skeleton className="h-24 w-full" />
  ) : isError ? (
    <div className="text-center py-6 space-y-3">
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load identity documents"}
      </p>
      <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
        Retry
      </Button>
    </div>
  ) : !documents?.length ? (
    <p className="text-sm text-muted-foreground text-center py-6">
      No identity documents on file. Click + Add document to get started.
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Type</th>
            <th className="pb-2 pr-3 font-medium">Number</th>
            <th className="pb-2 pr-3 font-medium">Country / State</th>
            <th className="pb-2 pr-3 font-medium">Expiry</th>
            <th className="pb-2 pr-3 font-medium">File</th>
            <th className="pb-2 pr-3 font-medium">Notes</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const badge = ID_DOC_TYPE_BADGE_STYLES[doc.docType];
            const expiryStatus = getExpiryStatus(doc.expiryDate, 60);

            return (
              <tr key={doc.id} className="border-b last:border-b-0 align-top">
                <td className="py-3 pr-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {ID_DOC_TYPE_LABELS[doc.docType]}
                  </span>
                </td>
                <td className="py-3 pr-3 font-mono text-xs text-muted-foreground tracking-wider">
                  {doc.documentNumber ?? "—"}
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {doc.country?.trim() || "—"}
                </td>
                <td className="py-3 pr-3">
                  {doc.expiryDate ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          expiryStatus === "expired"
                            ? "text-destructive font-medium"
                            : expiryStatus === "expiring_soon"
                              ? "text-amber-600 font-medium"
                              : ""
                        }
                      >
                        {format(parseISO(doc.expiryDate), "MMM d, yyyy")}
                      </span>
                      {expiryStatus === "expired" && (
                        <span className="inline-flex rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-medium">
                          Expired
                        </span>
                      )}
                      {expiryStatus === "expiring_soon" && (
                        <span className="inline-flex rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-medium">
                          Expiring soon
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs"
                    >
                      View file
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">No file</span>
                  )}
                </td>
                <td className="py-3 pr-3 max-w-[140px]">
                  <span
                    className="text-muted-foreground text-xs"
                    title={doc.notes && doc.notes.trim().length > 40 ? doc.notes : undefined}
                  >
                    {truncateNotes(doc.notes)}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => openEdit(doc)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {embedded ? (
        <div>
          {header}
          {body}
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Identity Documents</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add document
            </Button>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      )}

      <IdentityDocumentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        employeeId={employeeId}
        document={editingDoc}
        onSuccess={handleSuccess}
      />
    </>
  );
}
