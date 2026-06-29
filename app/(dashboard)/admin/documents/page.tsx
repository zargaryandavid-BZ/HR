"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Users } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents/constants";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { PageHeader, DataTable } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { DocumentFormModal } from "@/components/documents/document-form-modal";
import { DocumentAssignPanel } from "@/components/documents/document-assign-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { formatDisplayDate } from "@/lib/dates";

type DepartmentOption = { id: string; name: string };
type PositionOption = { id: string; name: string; department: { id: string; name: string } };

const SCOPE_OPTIONS = {
  ALL: "All Scopes",
  COMPANY_WIDE: "Company-wide",
  POSITION_SPECIFIC: "Position-specific",
} as const;

function statusBadgeClass(status: string, isActive: boolean): string {
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-700 border-slate-300";
  if (!isActive) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-green-100 text-green-800 border-green-200";
}

/** HR Admin document repository page */
export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
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
      return json.data as DepartmentOption[];
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["positions-for-documents"],
    queryFn: async () => {
      const res = await fetch("/api/settings/positions");
      const json = await res.json();
      return json.data as PositionOption[];
    },
  });

  const positionOptions = useMemo(() => {
    const list = positions ?? [];
    if (departmentFilter === "ALL") return list;
    return list.filter((position) => position.department?.id === departmentFilter);
  }, [positions, departmentFilter]);

  useEffect(() => {
    if (positionFilter === "ALL") return;
    if (!positionOptions.some((position) => position.id === positionFilter)) {
      setPositionFilter("ALL");
    }
  }, [positionFilter, positionOptions]);

  const filteredDocuments = useMemo(() => {
    let docs = [...(documents ?? [])];

    if (scopeFilter !== "ALL") {
      docs = docs.filter((doc) => doc.scope === scopeFilter);
    }

    const positionIdsInSelectedDepartment = new Set(
      (positions ?? [])
        .filter((position) => position.department?.id === departmentFilter)
        .map((position) => position.id)
    );

    if (departmentFilter !== "ALL") {
      docs = docs.filter((doc) => {
        if (doc.scope === "COMPANY_WIDE") return true;
        return (
          doc.departmentIds.includes(departmentFilter) ||
          doc.positionIds.some((id) => positionIdsInSelectedDepartment.has(id)) ||
          doc.assignmentTags.some(
            (tag) => tag.kind === "department" && tag.id === departmentFilter
          )
        );
      });
    }

    if (positionFilter !== "ALL") {
      docs = docs.filter((doc) => {
        if (doc.scope === "COMPANY_WIDE") return true;
        return (
          doc.positionIds.includes(positionFilter) ||
          doc.assignmentTags.some(
            (tag) => tag.kind === "position" && tag.id === positionFilter
          )
        );
      });
    }

    return docs;
  }, [documents, scopeFilter, departmentFilter, positionFilter, positions]);

  const hasFilters =
    search.trim().length > 0 ||
    typeFilter !== "ALL" ||
    statusFilter !== "all" ||
    scopeFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    positionFilter !== "ALL";

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

      <div className="sticky top-0 z-10 mb-6 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input
            placeholder="Search by title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="xl:col-span-2"
          />
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {(departments ?? []).map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Positions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Positions</SelectItem>
              {positionOptions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
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
          <div className="grid grid-cols-2 gap-3 xl:col-span-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCOPE_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DataTable>
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Scope</th>
            <th className="px-4 py-3 font-medium">Department / Position</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <TableRowSkeleton key={index} columns={7} />
            ))
          ) : filteredDocuments.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {hasFilters
                  ? "No documents match the selected filters."
                  : "No documents found. Add your first document to get started."}
              </td>
            </tr>
          ) : (
            filteredDocuments.map((doc) => {
              const visibleTags = doc.assignmentTags.slice(0, 2);
              const extraTagCount = Math.max(0, doc.assignmentTags.length - 2);

              return (
                <tr key={doc.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{doc.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {doc.description || "No description"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DocumentTypeBadge type={doc.documentType} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {doc.scope === "COMPANY_WIDE" ? "Company-wide" : "Position-specific"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {doc.scope === "COMPANY_WIDE" ? (
                      <span className="text-xs text-muted-foreground">All employees</span>
                    ) : doc.assignmentTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {visibleTags.map((tag) => (
                          <Badge key={`${tag.kind}-${tag.id}`} variant="secondary" className="text-xs">
                            {tag.label}
                          </Badge>
                        ))}
                        {extraTagCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{extraTagCount} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={statusBadgeClass(doc.status, doc.isActive)}>
                      {doc.status === "ARCHIVED"
                        ? "Archived"
                        : doc.isActive
                          ? "Active"
                          : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDisplayDate(doc.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(doc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {doc.scope === "POSITION_SPECIFIC" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignDoc(doc)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>

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
