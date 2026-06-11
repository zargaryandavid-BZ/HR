"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EmployeeLeaveSection } from "@/components/employee-portal/employee-leave-section";

export default function EmployeeLeavePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="My Leave"
        description="View your leave balances, submit requests, and track approvals."
      />
      <EmployeeLeaveSection />
    </div>
  );
}
