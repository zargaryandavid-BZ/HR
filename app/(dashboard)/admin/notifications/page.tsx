"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_COLORS: Record<string, string> = {
  LEAVE_APPROVED: "bg-green-100 text-green-800",
  LEAVE_REJECTED: "bg-red-100 text-red-800",
  LEAVE_CANCELLED: "bg-amber-100 text-amber-800",
  WRITE_UP_CREATED: "bg-red-100 text-red-800",
  WRITE_UP_UPDATED: "bg-amber-100 text-amber-800",
  DOCUMENT_ASSIGNED: "bg-blue-100 text-blue-800",
  DOCUMENT_HR_APPROVED: "bg-green-100 text-green-800",
  HR_DOC_SENT: "bg-blue-100 text-blue-800",
  ONBOARDING_STARTED: "bg-purple-100 text-purple-800",
};

/** HR admin log of notifications sent to employees */
export default function AdminNotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notifications", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (filter === "unread") params.set("isRead", "false");
      if (filter === "read") params.set("isRead", "true");
      const res = await fetch(`/api/admin/notifications?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      return json.data as { notifications: NotificationRow[] };
    },
  });

  const rows = (data?.notifications ?? []).filter((row) =>
    search.trim()
      ? row.employeeName.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="A log of all notifications sent to employees."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border p-1">
          {(["all", "unread", "read"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm capitalize",
                filter === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search by employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Read</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{row.employeeName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        TYPE_COLORS[row.type] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {row.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-md truncate">{row.message}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDisplayDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        row.isRead
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {row.isRead ? "Read" : "Unread"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
