"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeLeavePanel } from "@/components/employees/employee-leave-panel";
import { EmployeeLeaveHistory } from "@/components/employees/employee-leave-history";
import { CompensationForm } from "@/components/employees/compensation-form";
import { ToastBanner } from "@/components/shared/toast-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEmployeeName } from "@/lib/utils";
import { getDefaultScheduleConfig } from "@/components/employees/schedule-config-fields";
import type { EmployeeFormValues } from "@/lib/validations";
import { SendPortalNotificationButton } from "@/components/employees/send-portal-notification-button";
import { EmployeeClassificationBadge } from "@/components/shared/employee-classification-badge";
import { EmployeeDocumentsSection, OnboardingDocsPendingBadge } from "@/components/employees/individual-settings/employee-documents-section";
import { EmployeeOffboardingSection } from "@/components/employees/individual-settings/employee-offboarding-section";
import {
  EmployeeWriteUpsSection,
  WriteUpsPendingBadge,
} from "@/components/employees/individual-settings/employee-writeups-section";
import { EmployeeNotesSection } from "@/components/employees/individual-settings/employee-notes-section";
import { EmployeeHrDocumentsSection } from "@/components/employees/individual-settings/employee-hr-documents-section";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { EmployeeActivityTab } from "@/components/employees/individual-settings/employee-activity-tab";
import { Trash2 } from "lucide-react";
import { CopyEmployeePortalLinkButton } from "@/components/employees/copy-employee-portal-link-button";
import { useRouter } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

const TAB_QUERY_MAP: Record<string, string> = {
  leave: "leave",
  "write-ups": "writeups",
  writeups: "writeups",
  "onboarding-docs": "documents",
  documents: "documents",
  offboarding: "offboarding",
};

/** Employee detail page with flat profile tabs */
export default function EmployeeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam ? TAB_QUERY_MAP[tabParam] ?? "profile" : "profile";
  const queryClient = useQueryClient();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const { role: viewerRole } = useCurrentUser();

  const handleDeleteEmployee = async () => {
    if (
      !confirm(
        `⚠️ PERMANENTLY DELETE this employee?\n\nThis will remove the employee and ALL their data — time entries, leave records, documents, write-ups, and more.\n\nThis action CANNOT be undone. Type OK to confirm.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to delete");
      router.push("/admin/employees");
    } catch (err) {
      setToastVariant("error");
      setToast(err instanceof Error ? err.message : "Failed to delete employee");
    }
  };

  const handleSaveSuccess = (message: string) => {
    setToastVariant("success");
    setToast(message);
    queryClient.invalidateQueries({ queryKey: ["employee", id] });
  };

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
  });

  const formDefaults = useMemo<Partial<EmployeeFormValues> | undefined>(() => {
    if (!employee) return undefined;
    return {
      firstName: employee.firstName,
      lastName: employee.lastName,
      preferredName: employee.preferredName ?? "",
      personalEmail: employee.personalEmail ?? "",
      workEmail: employee.workEmail ?? "",
      phone: employee.phone ?? "",
      departmentId: employee.departmentId ?? "",
      positionId: employee.positionId ?? undefined,
      jobTitle: employee.jobTitle ?? "",
      employmentType: employee.employmentType,
      managerId: employee.managerId ?? undefined,
      payType: employee.payType,
      isNonExempt: employee.isNonExempt ?? true,
      startDate: employee.startDate
        ? new Date(employee.startDate).toISOString().split("T")[0]
        : "",
      scheduleType: employee.scheduleType,
      scheduleConfig: employee.scheduleConfig ?? getDefaultScheduleConfig(employee.scheduleType),
      emergencyContactName: employee.emergencyContactName ?? "",
      emergencyContactPhone: employee.emergencyContactPhone ?? "",
      emergencyContactRelation: employee.emergencyContactRelation ?? "",
      addressStreet: employee.addressStreet ?? "",
      addressCity: employee.addressCity ?? "",
      addressState: employee.addressState ?? undefined,
      addressZip: employee.addressZip ?? "",
      addressCountry: employee.addressCountry ?? "US",
      birthdate: employee.birthdate
        ? new Date(employee.birthdate).toISOString().split("T")[0]
        : "",
    };
  }, [employee]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee || !formDefaults) {
    return <p>Employee not found</p>;
  }

  return (
    <div>
      <ToastBanner message={toast} variant={toastVariant} />
      <PageHeader
        title={formatEmployeeName(
          employee.firstName,
          employee.lastName,
          employee.preferredName
        )}
        description={
          [
            employee.employeeNumber
              ? String(employee.employeeNumber).padStart(6, "0")
              : null,
            employee.jobTitle ?? null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Portal notification + copy link — HR Admin / Super Admin only */}
            {viewerRole && ["HR_ADMIN", "SUPER_ADMIN"].includes(viewerRole) && (
              <>
                <CopyEmployeePortalLinkButton
                  employeeId={id}
                  onSuccess={(message) => {
                    setToastVariant("success");
                    setToast(message);
                  }}
                  onError={(message) => {
                    setToastVariant("error");
                    setToast(message);
                  }}
                />
                <SendPortalNotificationButton
                  employeeId={id}
                  employeeName={formatEmployeeName(
                    employee.firstName,
                    employee.lastName,
                    employee.preferredName
                  )}
                  workEmail={employee.workEmail}
                  personalEmail={employee.personalEmail}
                  phone={employee.phone}
                  onSuccess={(message) => {
                    setToastVariant("success");
                    setToast(message);
                  }}
                  onError={(message) => {
                    setToastVariant("error");
                    setToast(message);
                  }}
                />
              </>
            )}
            <EmployeeClassificationBadge isNonExempt={employee.isNonExempt ?? true} />
            <Badge variant={employee.status === "ACTIVE" ? "success" : "secondary"}>
              {employee.status}
            </Badge>
            {employee.status === "ACTIVE" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (confirm("Deactivate this employee?")) {
                    await fetch(`/api/employees/${id}/deactivate`, { method: "POST" });
                    window.location.reload();
                  }
                }}
              >
                Deactivate
              </Button>
            )}
            {viewerRole === "SUPER_ADMIN" && employee.status === "INACTIVE" && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleDeleteEmployee}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Employee
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 h-auto flex-nowrap gap-0.5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="personal">Personal Information</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              Onboarding Docs
              <OnboardingDocsPendingBadge employeeId={id} />
            </TabsTrigger>
            <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
            <TabsTrigger value="writeups" className="gap-1.5">
              Write-ups
              <WriteUpsPendingBadge employeeId={id} />
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="hr-docs">HR Docs</TabsTrigger>
            <TabsTrigger value="time">Time History</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-4 space-y-6">
          <EmployeeForm
            key={`profile-${employee.updatedAt}`}
            employeeId={id}
            defaultValues={formDefaults}
            sections={["contact", "employment"]}
            onSuccess={() => handleSaveSuccess("Profile saved")}
          />
          {/* Compensation — shown to HR/Super Admin (edit) and Managers (read-only); hidden from employees */}
          {viewerRole && viewerRole !== "EMPLOYEE" && (
            <CompensationForm
              key={`comp-${employee.updatedAt}`}
              employeeId={id}
              viewerRole={viewerRole as "HR_ADMIN" | "SUPER_ADMIN" | "MANAGER"}
              payType={employee.payType ?? "HOURLY"}
              savedPayRate={employee.payRate ?? null}
              savedPayFrequency={employee.payFrequency ?? null}
              isNonExempt={employee.isNonExempt ?? true}
              savedEffectiveDate={
                employee.compensationEffectiveDate
                  ? new Date(employee.compensationEffectiveDate).toISOString().split("T")[0]
                  : null
              }
              onToast={setToast}
            />
          )}
        </TabsContent>

        <TabsContent value="personal" className="mt-4 space-y-4">
          <EmployeeForm
            key={`personal-${employee.updatedAt}`}
            employeeId={id}
            defaultValues={formDefaults}
            sections={["personal", "emergency"]}
            onSuccess={() => handleSaveSuccess("Personal information saved")}
            onToast={setToast}
            tShirtSize={employee.tShirtSize}
            allergies={employee.allergies}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <EmployeeForm
            key={`schedule-${employee.updatedAt}`}
            employeeId={id}
            defaultValues={formDefaults}
            sections={["schedule"]}
            onSuccess={() => {
              handleSaveSuccess("Schedule saved");
              queryClient.invalidateQueries({ queryKey: ["admin-break-schedule", id] });
            }}
            breakScheduleSettings={{
              employeeId: id,
              scheduleRevision: employee.updatedAt,
              mealBreak1WaiverEnabled: employee.mealBreak1WaiverEnabled ?? false,
              mealBreak2WaiverEnabled: employee.mealBreak2WaiverEnabled ?? false,
              onSaved: (message) => {
                setToastVariant("success");
                setToast(message);
                queryClient.invalidateQueries({ queryKey: ["employee", id] });
                queryClient.invalidateQueries({ queryKey: ["admin-break-schedule", id] });
              },
              onError: (message) => {
                setToastVariant("error");
                setToast(message);
              },
            }}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <EmployeeDocumentsSection
            employeeId={id}
            employeeName={formatEmployeeName(
              employee.firstName,
              employee.lastName,
              employee.preferredName
            )}
            positionName={employee.position?.name ?? employee.jobTitle ?? "this position"}
            hasPositionAutomation={(employee.position?.onboardingTemplates?.length ?? 0) > 0}
            mode="admin"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="offboarding" className="mt-4">
          <EmployeeOffboardingSection
            employeeId={id}
            employeeName={formatEmployeeName(
              employee.firstName,
              employee.lastName,
              employee.preferredName
            )}
            employeeStatus={employee.status}
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="writeups" className="mt-4">
          <EmployeeWriteUpsSection
            employeeId={id}
            mode="admin"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EmployeeNotesSection
            employeeId={id}
            mode="admin"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="hr-docs" className="mt-4">
          <EmployeeHrDocumentsSection
            employeeId={id}
            mode="admin"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Time History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Time entry history will be available in Phase 2.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/admin/timesheet?employeeId=${id}`}>View Timesheet</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-4 space-y-4">
          <EmployeeLeavePanel
            employeeId={id}
            onSuccess={handleSaveSuccess}
          />
          <EmployeeLeaveHistory employeeId={id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Activity &amp; Change History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeActivityTab employeeId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
