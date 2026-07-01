"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Building2, Eye, Pencil, Plus, User, Users } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents/constants";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { PageHeader, DataTable } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { DocumentFormModal } from "@/components/documents/document-form-modal";
import { DocumentAssignPanel } from "@/components/documents/document-assign-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { formatDisplayDate } from "@/lib/dates";

type DepartmentOption = { id: string; name: string };
type PositionOption = { id: string; name: string; department: { id: string; name: string } };
type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  department?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
};

type DocumentCategoryTab = "ALL" | "COMPANY" | "DEPARTMENT" | "POSITION" | "EMPLOYEE";

/** HR Admin document repository page */
export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryTab, setCategoryTab] = useState<DocumentCategoryTab>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
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

  const { data: employees } = useQuery({
    queryKey: ["employees-for-documents-filter"],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=200&status=ACTIVE");
      const json = await res.json();
      return (json.data?.employees ?? []) as EmployeeOption[];
    },
  });

  const selectedEmployee = useMemo(
    () => (employees ?? []).find((employee) => employee.id === employeeFilter) ?? null,
    [employees, employeeFilter]
  );

  const { data: employeeDirectDocIds, isLoading: isLoadingEmployeeAssignments } = useQuery({
    queryKey: ["documents-employee-assignments", employeeFilter, (documents ?? []).map((d) => d.id).join(",")],
    enabled: employeeFilter !== "ALL" && (documents?.length ?? 0) > 0,
    queryFn: async () => {
      const docs = documents ?? [];
      const directIds = new Set<string>();
      await Promise.all(
        docs.map(async (doc) => {
          const res = await fetch(`/api/documents/${doc.id}/assign`);
          if (!res.ok) return;
          const json = await res.json();
          const employeeIds: string[] = json.data?.employeeIds ?? [];
          if (employeeIds.includes(employeeFilter)) {
            directIds.add(doc.id);
          }
        })
      );
      return Array.from(directIds);
    },
  });

  const employeeDirectDocIdSet = useMemo(
    () => new Set(employeeDirectDocIds ?? []),
    [employeeDirectDocIds]
  );

  const positionOptions = useMemo(() => {
    const list = positions ?? [];
    if (departmentFilter === "ALL") return list;
    return list.filter((position) => position.department?.id === departmentFilter);
  }, [positions, departmentFilter]);

  useEffect(() => {
    if (categoryTab !== "EMPLOYEE" && employeeFilter !== "ALL") {
      setEmployeeFilter("ALL");
    }
  }, [categoryTab, employeeFilter]);

  useEffect(() => {
    if (positionFilter === "ALL") return;
    if (!positionOptions.some((position) => position.id === positionFilter)) {
      setPositionFilter("ALL");
    }
  }, [positionFilter, positionOptions]);

  const filteredDocuments = useMemo(() => {
    let docs = [...(documents ?? [])];

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

    if (employeeFilter !== "ALL" && selectedEmployee) {
      const selectedDeptId = selectedEmployee.department?.id ?? null;
      const selectedPositionId = selectedEmployee.position?.id ?? null;
      docs = docs.filter((doc) => {
        if (doc.scope === "COMPANY_WIDE") return true;
        if (employeeDirectDocIdSet.has(doc.id)) return true;
        if (selectedDeptId && doc.departmentIds.includes(selectedDeptId)) return true;
        if (selectedPositionId && doc.positionIds.includes(selectedPositionId)) return true;
        return false;
      });
    }

    return docs;
  }, [
    documents,
    departmentFilter,
    positionFilter,
    employeeFilter,
    selectedEmployee,
    employeeDirectDocIdSet,
    positions,
  ]);

  function isCompanyWideDocument(doc: DocumentListItem): boolean {
    return doc.scope === "COMPANY_WIDE";
  }

  function isDepartmentSpecificDocument(doc: DocumentListItem): boolean {
    return (
      doc.scope === "POSITION_SPECIFIC" &&
      doc.departmentIds.length > 0 &&
      doc.positionIds.length === 0
    );
  }

  function isPositionSpecificDocument(doc: DocumentListItem): boolean {
    return doc.scope === "POSITION_SPECIFIC" && doc.positionIds.length > 0;
  }

  function isEmployeeSpecificDocument(doc: DocumentListItem): boolean {
    return (
      doc.scope === "POSITION_SPECIFIC" &&
      doc.departmentIds.length === 0 &&
      doc.positionIds.length === 0
    );
  }

  const scopedGroups = useMemo(() => {
    const docs = filteredDocuments;
    return {
      company: docs.filter(isCompanyWideDocument),
      department: docs.filter(isDepartmentSpecificDocument),
      position: docs.filter(isPositionSpecificDocument),
      employee: docs.filter(isEmployeeSpecificDocument),
    };
  }, [filteredDocuments]);

  const tabbedDocuments = useMemo(() => {
    if (categoryTab === "ALL") {
      return filteredDocuments;
    }
    if (categoryTab === "COMPANY") {
      return scopedGroups.company;
    }
    if (categoryTab === "DEPARTMENT") {
      return scopedGroups.department;
    }
    if (categoryTab === "POSITION") {
      return scopedGroups.position;
    }
    return scopedGroups.employee;
  }, [filteredDocuments, categoryTab, scopedGroups]);

  const tabCounts = useMemo(
    () => ({
      all: filteredDocuments.length,
      company: scopedGroups.company.length,
      department: scopedGroups.department.length,
      position: scopedGroups.position.length,
      employee: scopedGroups.employee.length,
    }),
    [filteredDocuments, scopedGroups]
  );

  const hasFilters =
    search.trim().length > 0 ||
    typeFilter !== "ALL" ||
    statusFilter !== "all" ||
    departmentFilter !== "ALL" ||
    positionFilter !== "ALL" ||
    employeeFilter !== "ALL";

  function openCreate() {
    setEditingDoc(null);
    setFormOpen(true);
  }

  function openEdit(doc: DocumentListItem) {
    setEditingDoc(doc);
    setFormOpen(true);
  }

  function scopeVisual(doc: DocumentListItem) {
    if (isCompanyWideDocument(doc)) {
      return {
        pillClass: "bg-blue-50",
        icon: <Building2 className="h-4 w-4 text-blue-600" />,
        label: "Company-wide",
      };
    }
    if (isDepartmentSpecificDocument(doc)) {
      return {
        pillClass: "bg-emerald-50",
        icon: <Users className="h-4 w-4 text-emerald-600" />,
        label: "Department",
      };
    }
    if (isPositionSpecificDocument(doc)) {
      return {
        pillClass: "bg-amber-50",
        icon: <Briefcase className="h-4 w-4 text-amber-600" />,
        label: "Position",
      };
    }
    return {
      pillClass: "bg-pink-50",
      icon: <User className="h-4 w-4 text-pink-600" />,
      label: "Employee",
    };
  }

  function renderDocumentRow(doc: DocumentListItem) {
    const visual = scopeVisual(doc);
    const assignmentTags = doc.assignmentTags.filter(
      (tag) => tag.kind === "department" || tag.kind === "position"
    );
    const visibleTags = assignmentTags.slice(0, 3);
    const extraTagCount = Math.max(0, assignmentTags.length - 3);

    return (
      <tr key={doc.id} className="border-t align-top">
        <td className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${visual.pillClass}`}
              aria-label={visual.label}
            >
              {visual.icon}
            </div>
            <div className="min-w-0">
              <div className="font-medium">{doc.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {doc.description || "No description"}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {isCompanyWideDocument(doc) ? (
            <Badge variant="secondary" className="text-xs">
              All employees
            </Badge>
          ) : assignmentTags.length > 0 ? (
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
            <Button
              variant="outline"
              size="sm"
              className="border-dashed text-xs"
              onClick={() => setAssignDoc(doc)}
            >
              + Assign
            </Button>
          )}
        </td>
        <td className="px-4 py-3">
          <DocumentTypeBadge type={doc.documentType} />
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
              <Button variant="outline" size="sm" onClick={() => setAssignDoc(doc)}>
                <Users className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Company-wide</p>
            <p className="mt-1 text-2xl font-semibold">{tabCounts.company}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
            <p className="mt-1 text-2xl font-semibold">{tabCounts.department}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Position</p>
            <p className="mt-1 text-2xl font-semibold">{tabCounts.position}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Employee</p>
            <p className="mt-1 text-2xl font-semibold">{tabCounts.employee}</p>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-0 z-10 mb-6 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className={cn(
            "grid gap-3 md:grid-cols-2",
            categoryTab === "EMPLOYEE" ? "xl:grid-cols-7" : "xl:grid-cols-6"
          )}
        >
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
          {categoryTab === "EMPLOYEE" && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Employees</SelectItem>
                {(employees ?? []).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
                setStatusFilter("all");
                setDepartmentFilter("ALL");
                setPositionFilter("ALL");
                setEmployeeFilter("ALL");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={categoryTab}
        onValueChange={(value) => setCategoryTab(value as DocumentCategoryTab)}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ALL">
            All ({tabCounts.all})
          </TabsTrigger>
          <TabsTrigger value="COMPANY">
            Company-wide ({tabCounts.company})
          </TabsTrigger>
          <TabsTrigger value="DEPARTMENT">
            Department ({tabCounts.department})
          </TabsTrigger>
          <TabsTrigger value="POSITION">
            Position ({tabCounts.position})
          </TabsTrigger>
          <TabsTrigger value="EMPLOYEE">
            Employee ({tabCounts.employee})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable>
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Assignment</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading || isLoadingEmployeeAssignments ? (
            Array.from({ length: 6 }).map((_, index) => (
              <TableRowSkeleton key={index} columns={5} />
            ))
          ) : tabbedDocuments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {hasFilters
                  ? "No documents match the selected filters."
                  : "No documents in this tab yet."}
              </td>
            </tr>
          ) : categoryTab === "ALL" ? (
            <>
              <tr className="bg-muted/70 sticky top-0 z-[1]">
                <th
                  colSpan={5}
                  className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Company-wide - all employees ({scopedGroups.company.length})
                </th>
              </tr>
              {scopedGroups.company.map((doc) => renderDocumentRow(doc))}
              <tr className="bg-muted/70 sticky top-0 z-[1]">
                <th
                  colSpan={5}
                  className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Department-specific ({scopedGroups.department.length})
                </th>
              </tr>
              {scopedGroups.department.map((doc) => renderDocumentRow(doc))}
              <tr className="bg-muted/70 sticky top-0 z-[1]">
                <th
                  colSpan={5}
                  className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Position-specific ({scopedGroups.position.length})
                </th>
              </tr>
              {scopedGroups.position.map((doc) => renderDocumentRow(doc))}
              <tr className="bg-muted/70 sticky top-0 z-[1]">
                <th
                  colSpan={5}
                  className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Employee-specific ({scopedGroups.employee.length})
                </th>
              </tr>
              {scopedGroups.employee.map((doc) => renderDocumentRow(doc))}
            </>
          ) : (
            tabbedDocuments.map((doc) => renderDocumentRow(doc))
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
