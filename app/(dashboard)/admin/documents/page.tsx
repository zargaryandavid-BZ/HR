"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents/constants";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentFormModal } from "@/components/documents/document-form-modal";
import { DocumentAssignPanel } from "@/components/documents/document-assign-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** HR Admin document repository page */
export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentListItem | null>(null);
  const [assignDoc, setAssignDoc] = useState<DocumentListItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (statusFilter === "active") params.set("status", "active");
    if (statusFilter === "inactive") params.set("status", "inactive");
    if (statusFilter === "archived") params.set("status", "archived");
    return params.toString();
  }, [search, typeFilter, statusFilter]);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/documents?${queryParams}`);
      const json = await res.json();
      return json.data as DocumentListItem[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as { id: string; name: string }[];
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["positions-for-documents"],
    queryFn: async () => {
      const res = await fetch("/api/settings/positions");
      const json = await res.json();
      return json.data as Array<{ id: string; department: { id: string } }>;
    },
  });

  const companyWideDocs = useMemo(
    () =>
      (documents ?? [])
        .filter((d) => d.scope === "COMPANY_WIDE")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [documents]
  );

  const positionSpecificDocs = useMemo(() => {
    const docs = (documents ?? []).filter((d) => d.scope === "POSITION_SPECIFIC");
    if (departmentFilter === "ALL") return docs;

    const positionIdsInDept = new Set(
      (positions ?? [])
        .filter((p) => p.department.id === departmentFilter)
        .map((p) => p.id)
    );

    return docs.filter(
      (doc) =>
        doc.departmentIds.includes(departmentFilter) ||
        doc.positionIds.some((id) => positionIdsInDept.has(id)) ||
        doc.assignmentTags.some(
          (tag) => tag.kind === "department" && tag.id === departmentFilter
        )
    );
  }, [documents, departmentFilter, positions]);

  function openCreate() {
    setEditingDoc(null);
    setFormOpen(true);
  }

  function openEdit(doc: DocumentListItem) {
    setEditingDoc(doc);
    setFormOpen(true);
  }

  return (
    <div>
      <ToastBanner message={toast} variant="success" />
      <PageHeader
        title="Document repository"
        description="Central library for all company documents used in onboarding, compliance, and HR workflows"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-3 mb-8">
        <Input
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="lg:w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-10">
          <DocumentSection
            accentClass="border-l-blue-600"
            title="Company-wide documents"
            subtitle="Automatically included in every onboarding flow — required for all employees"
            docs={companyWideDocs}
            emptyTitle="No company-wide documents yet"
            emptyDescription="Add documents that every employee must receive, such as tax forms and the employee handbook."
            onEdit={openEdit}
            onCreate={openCreate}
          />

          <div className="border-t" />

          <section className="space-y-4">
            <div className={cn("border-l-[3px] pl-4", "border-l-teal-600")}>
              <h2 className="text-xl font-semibold">Position-specific documents</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Assigned to specific positions, departments, or individual employees
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterPill
                active={departmentFilter === "ALL"}
                onClick={() => setDepartmentFilter("ALL")}
              >
                All
              </FilterPill>
              {(departments ?? []).map((dept) => (
                <FilterPill
                  key={dept.id}
                  active={departmentFilter === dept.id}
                  onClick={() => setDepartmentFilter(dept.id)}
                >
                  {dept.name}
                </FilterPill>
              ))}
            </div>

            {positionSpecificDocs.length === 0 ? (
              <EmptyState
                title="No position-specific documents"
                description="Add documents assigned to specific positions, departments, or individuals."
                action={<Button onClick={openCreate}>Add Document</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {positionSpecificDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    showAssign
                    onEdit={() => openEdit(doc)}
                    onAssign={() => setAssignDoc(doc)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <DocumentFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        document={editingDoc}
        onSaved={({ notificationsSent }) => {
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
          setToast(
            notificationsSent ? "Document saved and notifications sent" : "Document saved"
          );
        }}
        onDeleted={() => {
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
          setEditingDoc(null);
          setToast("Document deleted");
        }}
      />

      {assignDoc && (
        <DocumentAssignPanel
          open={!!assignDoc}
          onOpenChange={(open) => !open && setAssignDoc(null)}
          documentId={assignDoc.id}
          documentTitle={assignDoc.title}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["documents"] });
            setToast("Assignments saved");
          }}
        />
      )}

    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function DocumentSection({
  accentClass,
  title,
  subtitle,
  docs,
  emptyTitle,
  emptyDescription,
  onEdit,
  onCreate,
}: {
  accentClass: string;
  title: string;
  subtitle: string;
  docs: DocumentListItem[];
  emptyTitle: string;
  emptyDescription: string;
  onEdit: (doc: DocumentListItem) => void;
  onCreate: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className={cn("border-l-[3px] pl-4", accentClass)}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {docs.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={<Button onClick={onCreate}>Add Document</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onEdit={() => onEdit(doc)} />
          ))}
        </div>
      )}
    </section>
  );
}
