"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorMessage } from "@/components/shared/page-header";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  departmentName: string | null;
};

type DocumentAssignPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
  onSaved: () => void;
};

/** Slide-over panel for assigning a position-specific document */
export function DocumentAssignPanel({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  onSaved,
}: DocumentAssignPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as { id: string; name: string }[];
    },
    enabled: open,
  });

  const { data: positions } = useQuery({
    queryKey: ["positions-for-documents"],
    queryFn: async () => {
      const res = await fetch("/api/settings/positions");
      const json = await res.json();
      return json.data as Array<{
        id: string;
        name: string;
        department: { id: string; name: string };
        isActive: boolean;
      }>;
    },
    enabled: open,
  });

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees-for-assign"],
    queryFn: async () => {
      const res = await fetch("/api/employees?status=ACTIVE&limit=500");
      const json = await res.json();
      return (json.data?.employees ?? []).map(
        (e: EmployeeOption & { department?: { id: string; name: string } | null }) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          departmentId: e.department?.id ?? null,
          departmentName: e.department?.name ?? null,
        })
      ) as EmployeeOption[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open || !documentId) return;
    setSearch("");
    setError(null);
    void fetch(`/api/documents/${documentId}/assign`)
      .then((r) => r.json())
      .then((json) => {
        setSelectedEmployees(new Set(json.data?.employeeIds ?? []));
        setSelectedPositions(new Set(json.data?.positionIds ?? []));
        setSelectedDepartments(new Set(json.data?.departmentIds ?? []));
      });
  }, [open, documentId]);

  const positionsByDepartment = useMemo(() => {
    const map = new Map<string, NonNullable<typeof positions>>();
    for (const pos of positions ?? []) {
      if (!pos.isActive) continue;
      const deptName = pos.department.name;
      if (!map.has(deptName)) map.set(deptName, []);
      map.get(deptName)!.push(pos);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [positions]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      const dept = (e.departmentName ?? "").toLowerCase();
      return !q || name.includes(q) || dept.includes(q);
    });
  }, [employees, search]);

  const groupedEmployees = useMemo(() => {
    const map = new Map<string, EmployeeOption[]>();
    for (const emp of filteredEmployees) {
      const key = emp.departmentName ?? "No Department";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(emp);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees]);

  function toggleSetItem(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Save position, department, and employee assignments */
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: [...selectedEmployees],
          positionIds: [...selectedPositions],
          departmentIds: [...selectedDepartments],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-hidden flex flex-col max-w-2xl">
        <SheetHeader>
          <SheetTitle>Assign &apos;{documentTitle}&apos;</SheetTitle>
        </SheetHeader>

        {error && <div className="px-6"><ErrorMessage message={error} /></div>}

        <Tabs defaultValue="positions" className="flex-1 flex flex-col overflow-hidden px-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="employees">Individual</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="flex-1 overflow-y-auto mt-4 space-y-4">
            {positionsByDepartment.map(([deptName, deptPositions]) => (
              <div key={deptName}>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  {deptName}
                </p>
                <div className="space-y-2">
                  {deptPositions.map((pos) => (
                    <label key={pos.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedPositions.has(pos.id)}
                        onCheckedChange={() => toggleSetItem(setSelectedPositions, pos.id)}
                      />
                      {pos.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="departments" className="flex-1 overflow-y-auto mt-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Selecting a department assigns this document to all current and future employees in
              that department.
            </p>
            {(departments ?? []).map((dept) => (
              <label key={dept.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedDepartments.has(dept.id)}
                  onCheckedChange={() => toggleSetItem(setSelectedDepartments, dept.id)}
                />
                {dept.name}
              </label>
            ))}
          </TabsContent>

          <TabsContent value="employees" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or department"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {employeesLoading && (
                <p className="text-sm text-muted-foreground">Loading employees...</p>
              )}
              {groupedEmployees.map(([dept, emps]) => (
                <div key={dept}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    {dept}
                  </p>
                  {emps.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 py-1.5 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedEmployees.has(emp.id)}
                        onCheckedChange={() => toggleSetItem(setSelectedEmployees, emp.id)}
                      />
                      {emp.firstName} {emp.lastName}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Assignments"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
