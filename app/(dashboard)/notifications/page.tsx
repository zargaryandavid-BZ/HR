"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/** Full notification history page */
export default function NotificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=50");
      const json = await res.json();
      return json.data as {
        notifications: {
          id: string;
          eventType: string;
          status: string;
          contentSnapshot: { message?: string } | null;
          createdAt: string;
        }[];
      };
    },
  });

  const notifications = data?.notifications ?? [];

  return (
    <div>
      <PageHeader title="Notifications" description="Your notification history" />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between rounded-lg border p-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {n.contentSnapshot?.message ?? n.eventType}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              <Badge variant={n.status === "READ" ? "secondary" : "default"}>
                {n.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
