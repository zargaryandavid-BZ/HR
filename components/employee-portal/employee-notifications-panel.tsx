"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, File, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  message: string;
  channel: string;
  status: string;
  isRead: boolean;
  createdAt: string;
};

function notificationIcon(message: string) {
  const msg = message.toLowerCase();
  if (msg.includes("write-up") || msg.includes("disciplinary")) return AlertTriangle;
  if (msg.includes("approved")) return CheckCircle2;
  if (msg.includes("rejected") || msg.includes("denied")) return X;
  if (msg.includes("document") || msg.includes("sign")) return File;
  return Bell;
}

/** Notifications slide-over panel */
export function EmployeeNotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["employee-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/employee/notifications");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/employee/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["employee-notifications"] }),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-80 sm:max-w-sm p-0">
        <SheetHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-3 pr-12">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          {unreadCount > 0 && (
            <button
              type="button"
              className="shrink-0 whitespace-nowrap text-xs text-primary hover:underline"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              Mark all read
            </button>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !notifications?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => {
              const Icon = notificationIcon(n.message);
              const isWriteUp = n.message.toLowerCase().includes("write-up");
              const isApproved = n.message.toLowerCase().includes("approved");
              const isRejected =
                n.message.toLowerCase().includes("rejected") ||
                n.message.toLowerCase().includes("denied");

              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors",
                    !n.isRead && "border-l-2 border-blue-500 bg-blue-50/40"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full p-1.5",
                      isWriteUp
                        ? "bg-amber-100 text-amber-700"
                        : isApproved
                        ? "bg-green-100 text-green-700"
                        : isRejected
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Bell icon button with unread badge — renders in topbar */
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["employee-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/employee/notifications");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const { data: onboardingDocs } = useQuery<{
    companyWide: Array<{ status: string }>;
    assigned: Array<{ status: string }>;
  }>({
    queryKey: ["employee-onboarding-docs"],
    queryFn: async () => {
      const res = await fetch("/api/employee/documents");
      const json = await res.json();
      return json.data ?? { companyWide: [], assigned: [] };
    },
  });

  const { data: onboardingTasks } = useQuery<{ pendingCount: number }>({
    queryKey: ["employee-onboarding-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/employee/onboarding-tasks");
      const json = await res.json();
      return json.data ?? { pendingCount: 0 };
    },
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;
  const onboardingPending = onboardingTasks?.pendingCount ?? 0;
  const allOnboardingDocs = [
    ...(onboardingDocs?.companyWide ?? []),
    ...(onboardingDocs?.assigned ?? []),
  ];
  const unconfirmedDocCount = allOnboardingDocs.filter(
    (doc) => doc.status !== "hr_approved"
  ).length;
  const badgeCount = unreadCount + onboardingPending + unconfirmedDocCount;

  return (
    <button
      className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      onClick={onClick}
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5 text-slate-600" />
      {badgeCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </button>
  );
}
