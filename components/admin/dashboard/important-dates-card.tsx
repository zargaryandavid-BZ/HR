"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatStoredDate } from "@/lib/dates";
import {
  DashboardEmptyState,
  DashboardPanel,
} from "@/components/admin/dashboard/dashboard-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvatarColor } from "@/lib/admin/dashboard-utils";
import type { AdminImportantDateItem } from "@/lib/admin/important-dates";
import { cn } from "@/lib/utils";

type ImportantDatesResponse = {
  items: AdminImportantDateItem[];
  days: number;
};

const LOOKAHEAD_OPTIONS = [30, 60, 90] as const;

const TYPE_META: Record<
  AdminImportantDateItem["type"],
  { icon: string; accent: string; typeLabel: (item: AdminImportantDateItem) => string }
> = {
  BIRTHDAY: {
    icon: "🎂",
    accent: "text-rose-600 bg-rose-50",
    typeLabel: () => "Birthday",
  },
  ANNIVERSARY: {
    icon: "🎉",
    accent: "text-purple-700 bg-purple-50",
    typeLabel: (item) =>
      item.years ? `${item.years}-Year Anniversary` : "Work Anniversary",
  },
  HOLIDAY: {
    icon: "🏖",
    accent: "text-blue-700 bg-blue-50",
    typeLabel: () => "Holiday",
  },
  EVENT: {
    icon: "📅",
    accent: "text-gray-700 bg-gray-100",
    typeLabel: () => "Event",
  },
};

type DateGroup = {
  key: "today" | "thisWeek" | "comingUp";
  label: string;
  items: AdminImportantDateItem[];
};

/** Group items into TODAY / THIS WEEK / COMING UP buckets */
function groupItems(items: AdminImportantDateItem[]): DateGroup[] {
  const today: AdminImportantDateItem[] = [];
  const thisWeek: AdminImportantDateItem[] = [];
  const comingUp: AdminImportantDateItem[] = [];

  for (const item of items) {
    if (item.daysUntil === 0) today.push(item);
    else if (item.daysUntil <= 6) thisWeek.push(item);
    else comingUp.push(item);
  }

  const groups: DateGroup[] = [];
  if (today.length) groups.push({ key: "today", label: "TODAY", items: today });
  if (thisWeek.length) groups.push({ key: "thisWeek", label: "THIS WEEK", items: thisWeek });
  if (comingUp.length) groups.push({ key: "comingUp", label: "COMING UP", items: comingUp });
  return groups;
}

/** Format a date for display — birthdays never show birth year */
function formatItemDate(item: AdminImportantDateItem): string {
  return formatStoredDate(item.date, { monthDayOnly: true });
}

/** Date badge for row trailing column */
function DateBadge({ daysUntil, dateLabel }: { daysUntil: number; dateLabel: string }) {
  if (daysUntil === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Today
      </span>
    );
  }
  if (daysUntil === 1) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Tomorrow
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground whitespace-nowrap">{dateLabel}</span>;
}

function ImportantDateRow({ item }: { item: AdminImportantDateItem }) {
  const meta = TYPE_META[item.type];
  const dateLabel = formatItemDate(item);
  const isEmployeeEvent = item.type === "BIRTHDAY" || item.type === "ANNIVERSARY";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {isEmployeeEvent && item.employeeId && item.avatarInitials ? (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
            getAvatarColor(item.employeeId)
          )}
        >
          {item.avatarInitials}
        </div>
      ) : (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base",
            meta.accent
          )}
        >
          {meta.icon}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isEmployeeEvent ? item.employeeName : item.label}
        </p>
        {item.position && (
          <p className="truncate text-xs text-muted-foreground">{item.position}</p>
        )}
      </div>

      <span className="hidden text-xs text-muted-foreground sm:inline whitespace-nowrap">
        {meta.typeLabel(item)}
      </span>

      <DateBadge daysUntil={item.daysUntil} dateLabel={dateLabel} />
    </div>
  );
}

/** Upcoming birthdays, anniversaries, and holidays for HR */
export function ImportantDatesCard() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-important-dates", days],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/important-dates?days=${days}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load important dates");
      return json.data as ImportantDatesResponse;
    },
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const groups = groupItems(items);

  return (
    <DashboardPanel
      title="Important Dates"
      badge={
        <Select
          value={String(days)}
          onValueChange={(value) => setDays(Number.parseInt(value, 10))}
        >
          <SelectTrigger className="h-8 w-auto min-w-[8.75rem] shrink-0 px-2.5 text-xs font-normal [&>span]:line-clamp-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOOKAHEAD_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)} className="text-xs">
                Next {option} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <DashboardEmptyState message="Failed to load important dates." />
      ) : items.length === 0 ? (
        <DashboardEmptyState message={`No important dates in the next ${days} days`} />
      ) : (
        <div className="divide-y">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="bg-muted/40 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y">
                {group.items.map((item) => (
                  <ImportantDateRow
                    key={`${item.type}-${item.date}-${item.employeeId ?? item.label}`}
                    item={item}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
