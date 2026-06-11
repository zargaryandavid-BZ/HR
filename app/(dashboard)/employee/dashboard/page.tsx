import { redirect } from "next/navigation";
import { getEmployeeSession } from "@/lib/employee-session";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeClockWidget } from "@/components/employee-portal/employee-clock-widget";
import { EmployeeLeaveSection } from "@/components/employee-portal/employee-leave-section";
import { EmployeeBreakScheduleSection } from "@/components/employee-portal/employee-break-schedule-section";
import { OnboardingTasksBanner } from "@/components/employee-portal/employee-onboarding-tasks-section";
import { EmployeeWriteUpsSection } from "@/components/employee-portal/employee-writeups-section";
import { EmployeeHrDocsSection } from "@/components/employee-portal/employee-hr-docs-section";

export default async function EmployeeDashboardPage() {
  const session = await getEmployeeSession();
  if (!session) redirect("/employee/login");
  return (
    <div className="space-y-4">
      <PageHeader
        title="My Dashboard"
        description="Your shift status, leave balances, and team updates."
      />
      <EmployeeClockWidget />
      <OnboardingTasksBanner />
      <EmployeeLeaveSection />
      <EmployeeBreakScheduleSection />
      <EmployeeWriteUpsSection />
      <EmployeeHrDocsSection />
    </div>
  );
}
