import { requireRole } from "@/lib/auth";
import { fetchAdminDashboardData } from "@/lib/admin/dashboard-data";
import { formatHeaderDate, parseViewMonth } from "@/lib/admin/dashboard-utils";
import { KpiCards } from "@/components/admin/dashboard/kpi-cards";
import { OnboardingInProgressCard } from "@/components/admin/dashboard/onboarding-card";
import { ImportantDatesCard } from "@/components/admin/dashboard/important-dates-card";
import { PendingLeaveRequestsCard } from "@/components/admin/dashboard/pending-leave-card";
import { TeamLeaveCalendar } from "@/components/admin/dashboard/team-leave-calendar";
import { ExpiringDocumentsCard } from "@/components/admin/dashboard/expiring-documents-card";
import { OffboardingInProgressCard } from "@/components/admin/dashboard/offboarding-card";
import { RecentWriteUpsCard } from "@/components/admin/dashboard/recent-writeups-card";
import { UnsignedDocumentsCard } from "@/components/admin/dashboard/unsigned-documents-card";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export const dynamic = "force-dynamic";

/** HR Admin dashboard with live KPIs, leave, write-ups, and documents */
export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
  const { month: monthParam } = await searchParams;
  const viewMonth = parseViewMonth(monthParam);
  const data = await fetchAdminDashboardData(viewMonth);

  const firstName =
    session.employee?.firstName ??
    session.name?.split(" ")[0] ??
    "Admin";

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Good morning, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {formatHeaderDate(today)}
          {data.nearTermImportantDatesCount > 0 ? (
            <>
              {" "}
              · {data.nearTermImportantDatesCount} upcoming date
              {data.nearTermImportantDatesCount !== 1 ? "s" : ""} today or tomorrow
            </>
          ) : (
            <>
              {" "}
              · {data.attentionCount} item
              {data.attentionCount !== 1 ? "s" : ""} need your attention
            </>
          )}
        </p>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <OnboardingInProgressCard instances={data.onboardingInProgress} />
          <PendingLeaveRequestsCard
            requests={data.pendingLeaveRequests}
            totalPending={data.pendingLeaveTotal}
          />
          <ImportantDatesCard />
        </div>
        <div className="lg:col-span-3">
          <TeamLeaveCalendar
            leaveRequests={data.leaveThisMonth}
            viewMonth={data.viewMonth}
            viewMonthLabel={data.viewMonthLabel}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <RecentWriteUpsCard
          writeUps={data.recentWriteUps}
          unacknowledgedCount={data.unacknowledgedWriteUpsCount}
        />
        <UnsignedDocumentsCard
          assignments={data.unsignedAssignments}
          unsignedCount={data.kpis.unsignedDocsCount}
        />
        <ExpiringDocumentsCard
          documents={data.expiringDocuments}
          totalCount={data.expiringDocumentsCount}
        />
        <OffboardingInProgressCard instances={data.offboardingInProgress} />
      </div>
    </div>
  );
}
