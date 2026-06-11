"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  Activity,
  ChevronDown,
  FileText,
  KeyRound,
  Mail,
  PencilLine,
  ShieldCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ActivityItem = {
  id: string;
  action: string;
  label: string;
  performedBy: string;
  reason: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  EMPLOYEE_CREATED: <UserCog className="h-3.5 w-3.5" />,
  EMPLOYEE_UPDATED: <PencilLine className="h-3.5 w-3.5" />,
  EMPLOYEE_DEACTIVATED: <UserX className="h-3.5 w-3.5" />,
  EMPLOYEE_REACTIVATED: <UserCog className="h-3.5 w-3.5" />,
  EMPLOYEE_PORTAL_ACCESSED: <KeyRound className="h-3.5 w-3.5" />,
  ONBOARDING_DOCS_SENT: <Mail className="h-3.5 w-3.5" />,
  DOCUMENT_APPROVED: <ShieldCheck className="h-3.5 w-3.5" />,
  DOCUMENT_SIGNED: <FileText className="h-3.5 w-3.5" />,
  TIME_ENTRY_EDITED: <PencilLine className="h-3.5 w-3.5" />,
  COMPENSATION_UPDATED: <PencilLine className="h-3.5 w-3.5" />,
  LEAVE_BALANCE_ADJUSTED: <PencilLine className="h-3.5 w-3.5" />,
  WRITE_UP_CREATED: <FileText className="h-3.5 w-3.5" />,
};

const ACTION_COLOR: Record<string, string> = {
  EMPLOYEE_CREATED: "bg-green-100 text-green-700 border-green-200",
  EMPLOYEE_UPDATED: "bg-blue-50 text-blue-700 border-blue-200",
  EMPLOYEE_DEACTIVATED: "bg-red-50 text-red-700 border-red-200",
  EMPLOYEE_REACTIVATED: "bg-green-50 text-green-700 border-green-200",
  EMPLOYEE_PORTAL_ACCESSED: "bg-violet-50 text-violet-700 border-violet-200",
  ONBOARDING_DOCS_SENT: "bg-amber-50 text-amber-700 border-amber-200",
  DOCUMENT_APPROVED: "bg-green-50 text-green-700 border-green-200",
  DOCUMENT_SIGNED: "bg-teal-50 text-teal-700 border-teal-200",
  TIME_ENTRY_EDITED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPENSATION_UPDATED: "bg-purple-50 text-purple-700 border-purple-200",
  LEAVE_BALANCE_ADJUSTED: "bg-orange-50 text-orange-700 border-orange-200",
  WRITE_UP_CREATED: "bg-red-50 text-red-700 border-red-200",
};

function DiffView({
  oldValue,
  newValue,
}: {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  if (!oldValue && !newValue) return null;

  const allKeys = Array.from(
    new Set([
      ...Object.keys(oldValue ?? {}),
      ...Object.keys(newValue ?? {}),
    ])
  ).filter((k) => {
    const o = (oldValue ?? {})[k];
    const n = (newValue ?? {})[k];
    return o !== n;
  });

  if (allKeys.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs space-y-1">
      {allKeys.map((key) => {
        const before = (oldValue ?? {})[key];
        const after = (newValue ?? {})[key];
        return (
          <div key={key} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="font-medium text-muted-foreground w-28 shrink-0 capitalize">
              {key.replace(/([A-Z])/g, " $1").toLowerCase()}
            </span>
            {before !== undefined && (
              <span className="line-through text-red-500/80">{String(before)}</span>
            )}
            {after !== undefined && (
              <span className="text-green-700">{String(after)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff =
    (item.oldValue && Object.keys(item.oldValue).length > 0) ||
    (item.newValue && Object.keys(item.newValue).length > 0);

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      {/* Timeline dot */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
        {ACTION_ICON[item.action] ?? <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] px-1.5 py-0",
              ACTION_COLOR[item.action] ?? "bg-muted text-muted-foreground"
            )}
          >
            {item.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            by <span className="font-medium text-foreground">{item.performedBy}</span>
          </span>
        </div>

        {item.reason && (
          <p className="mt-1 text-xs text-muted-foreground italic">"{item.reason}"</p>
        )}

        {hasDiff && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-1 text-xs text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={cn("h-3 w-3 mr-1 transition-transform", expanded && "rotate-180")}
            />
            {expanded ? "Hide" : "Show"} changes
          </Button>
        )}

        {expanded && hasDiff && (
          <DiffView oldValue={item.oldValue} newValue={item.newValue} />
        )}

        <p
          className="mt-1 text-[11px] text-muted-foreground"
          title={format(new Date(item.createdAt), "PPpp")}
        >
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          <span className="ml-1 text-muted-foreground/60">
            · {format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}
          </span>
        </p>
      </div>
    </div>
  );
}

export function EmployeeActivityTab({ employeeId }: { employeeId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<ActivityItem[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["employee-activity", employeeId, cursor],
    queryFn: async () => {
      const url = `/api/employees/${employeeId}/activity?limit=25${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { items: ActivityItem[]; nextCursor: string | null };
    },
  });

  // Accumulate pages (replaces removed onSuccess callback in TanStack Query v5)
  useEffect(() => {
    if (!data) return;
    setAllItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const fresh = data.items.filter((i) => !existingIds.has(i.id));
      return cursor ? [...prev, ...fresh] : data.items;
    });
  }, [data, cursor]);

  const items = allItems.length > 0 ? allItems : (data?.items ?? []);
  const nextCursor = data?.nextCursor ?? null;

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Changes, portal access, and document events will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => setCursor(nextCursor)}
          >
            {isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
