"use client";

import { useState } from "react";
import { ToastBanner } from "@/components/shared/toast-banner";
import { EmployeeDocumentsSection } from "@/components/employees/individual-settings/employee-documents-section";
import { EmployeeWriteUpsSection } from "@/components/employees/individual-settings/employee-writeups-section";
import { EmployeeHrDocumentsSection } from "@/components/employees/individual-settings/employee-hr-documents-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

/** Client wrapper for employee profile with flat tabs */
export function EmployeeProfileSettings() {
  const { employeeId, isLoading } = useCurrentUser();
  const [toast, setToast] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!employeeId) {
    return (
      <p className="text-muted-foreground text-sm">
        No employee profile is linked to your account.
      </p>
    );
  }

  return (
    <>
      <ToastBanner message={toast} variant="success" />
      <Tabs defaultValue="documents">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 h-auto flex-nowrap gap-0.5">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="writeups">Write-ups</TabsTrigger>
            <TabsTrigger value="hr-docs">HR Docs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="mt-4">
          <EmployeeDocumentsSection
            employeeId={employeeId}
            mode="employee"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="writeups" className="mt-4">
          <EmployeeWriteUpsSection
            employeeId={employeeId}
            mode="employee"
            onToast={setToast}
          />
        </TabsContent>

        <TabsContent value="hr-docs" className="mt-4">
          <EmployeeHrDocumentsSection
            employeeId={employeeId}
            mode="employee"
            onToast={setToast}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
