"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  eventType: string;
  contentSnapshot: {
    message?: string;
    href?: string;
    actionLabel?: string;
  } | null;
  createdAt: string;
  isActionRequired?: boolean;
};

/** Header notification bell with unread count and dropdown */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const { user, role } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true&limit=10");
      const json = await res.json();
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return json.data as { notifications: Notification[]; unreadCount: number };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/mark-read", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
    },
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];
  const isApprover = role === "HR_ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2 font-semibold text-sm">Notifications</div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No new notifications
          </div>
        ) : (
          notifications.map((n) => {
            const href = n.contentSnapshot?.href;
            const content = (
              <>
                <span className="text-sm">
                  {n.contentSnapshot?.message ?? n.eventType}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
                {n.isActionRequired && href && (
                  <span className="text-xs font-medium text-primary">
                    {n.contentSnapshot?.actionLabel ?? "Review"} →
                  </span>
                )}
              </>
            );

            if (href) {
              return (
                <DropdownMenuItem key={n.id} asChild className="flex flex-col items-start gap-1 py-2">
                  <Link href={href}>{content}</Link>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2">
                {content}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        {unreadCount > 0 && !isApprover && (
          <DropdownMenuItem onClick={() => markAllRead.mutate()}>
            Mark all read
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={isApprover ? "/admin/leave" : "/notifications"}>
            {isApprover ? "Review leave requests" : "View all"}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
