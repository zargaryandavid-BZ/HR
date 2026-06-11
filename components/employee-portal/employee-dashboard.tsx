"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmployeeSidebar } from "./employee-sidebar";
import { EmployeeLeaveSection } from "./employee-leave-section";
import { EmployeeBreakScheduleSection } from "./employee-break-schedule-section";
import { EmployeeOnboardingTasksSection, OnboardingTasksBanner } from "./employee-onboarding-tasks-section";
import { EmployeeWriteUpsSection } from "./employee-writeups-section";
import { EmployeeHrDocsSection } from "./employee-hr-docs-section";
import { EmployeeOnboardingSection } from "./employee-onboarding-section";
import { EmployeeOffboardingSection } from "./employee-offboarding-section";
import {
  EmployeeNotificationsPanel,
  NotificationBell,
} from "./employee-notifications-panel";
import { UserCog } from "lucide-react";
import { EmployeeClockWidget } from "./employee-clock-widget";
import { EmployeeTimeHistory } from "./employee-time-history";

type MeData = {
  id: string;
  firstName: string;
  preferredName?: string | null;
  phone?: string | null;
  workEmail?: string | null;
};

/** Full employee dashboard — desktop-first single-page layout. */
export function EmployeeDashboard() {
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: me } = useQuery<MeData>({
    queryKey: ["employee-me"],
    queryFn: async () => {
      const res = await fetch("/api/employee/me");
      const json = await res.json();
      return json.data;
    },
  });

  const displayName = me ? (me.preferredName ?? me.firstName) : "Employee";

  async function handleLogout() {
    await fetch("/api/employee/auth/logout", { method: "POST" });
    router.push("/employee/login");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <header className="z-40 shrink-0 border-b bg-white h-14 flex items-center px-4 gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            PP
          </div>
          <div className="text-sm font-semibold text-slate-800 hidden sm:block">
            Employee Portal
            <span className="text-slate-400 font-normal"> · Pixel Press Print</span>
          </div>
        </div>

        <div className="flex-1" />

        <NotificationBell onClick={() => setNotifOpen(true)} />

        {/* Avatar / name + profile link */}
        <button
          onClick={() => router.push("/employee/profile")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="My Profile"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase">
            {displayName.slice(0, 1)}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">{displayName}</span>
          <UserCog className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        </button>

        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1"
        >
          Sign out
        </button>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto overscroll-y-contain p-4 max-w-[1200px] mx-auto w-full">
        {/* Left sidebar */}
        <EmployeeSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-4">
          <EmployeeClockWidget />
          <EmployeeTimeHistory />
          <OnboardingTasksBanner />
          <EmployeeLeaveSection />
          <EmployeeBreakScheduleSection />
          <EmployeeOnboardingTasksSection />
          <EmployeeWriteUpsSection />
          <EmployeeHrDocsSection />
          <EmployeeOnboardingSection />
          <EmployeeOffboardingSection />
        </main>
      </div>

      {/* Notifications panel */}
      <EmployeeNotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
