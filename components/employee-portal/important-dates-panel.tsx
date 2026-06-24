"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, X, AlertTriangle, Clock, CalendarCheck, FileText, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/dates";

type DateUrgency = "overdue" | "urgent" | "warning" | "upcoming";

type ImportantDateItem = {
  type: string;
  label: string;
  date: string;
  daysUntil: number;
  urgency: DateUrgency;
};

const TYPE_ICON: Record<string, React.ElementType> = {
  contract_end: AlertTriangle,
  probation_end: Clock,
  performance_review: CalendarCheck,
  benefits_enrollment: Calendar,
  anniversary: Star,
  document_deadline: FileText,
};

const URGENCY_STYLES: Record<DateUrgency, { border: string; label: string; badge: string; icon: string }> = {
  overdue: { border: "border-l-red-500", label: "text-red-600", badge: "bg-red-500", icon: "text-red-500" },
  urgent:  { border: "border-l-amber-500", label: "text-amber-700", badge: "bg-amber-500", icon: "text-amber-500" },
  warning: { border: "border-l-blue-500", label: "text-blue-700", badge: "bg-blue-500", icon: "text-blue-500" },
  upcoming: { border: "border-l-slate-300", label: "text-slate-600", badge: "bg-slate-400", icon: "text-slate-400" },
};

function formatDateLabel(isoDate: string): string {
  try {
    return formatDisplayDate(isoDate);
  } catch {
    return isoDate;
  }
}

function daysLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "1 day";
  if (daysUntil === -1) return "1 day ago";
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  return `${daysUntil} days`;
}

/** Calendar icon + badge that opens an anchored popover of important employee dates */
export function ImportantDatesPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { data: dates = [] } = useQuery<ImportantDateItem[]>({
    queryKey: ["important-dates"],
    queryFn: async () => {
      const res = await fetch("/api/employee/important-dates");
      const json = await res.json();
      return (json.data ?? []) as ImportantDateItem[];
    },
    staleTime: 60_000,
  });

  // Badge = count of overdue + urgent + warning items
  const badgeCount = dates.filter((d) => d.urgency !== "upcoming").length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative">
      {/* Trigger row */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
      >
        <div className="relative shrink-0">
          <Calendar className="h-4 w-4 text-slate-500" />
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
              {badgeCount}
            </span>
          )}
        </div>
        <span className={cn("text-[12px]", badgeCount > 0 ? "text-slate-700 font-medium" : "text-slate-400")}>
          Important Dates
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-1 z-50 w-[260px] rounded-xl border bg-white shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[12px] font-semibold text-slate-700">Important Dates</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Date list */}
          <div className="divide-y max-h-80 overflow-y-auto">
            {dates.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic text-center py-5 px-3">
                No upcoming important dates.
              </p>
            )}
            {dates.map((item, i) => {
              const styles = URGENCY_STYLES[item.urgency];
              const Icon = TYPE_ICON[item.type] ?? Calendar;
              return (
                <div key={i} className={cn("flex gap-2.5 px-3 py-2.5 border-l-[3px]", styles.border)}>
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", styles.icon)} />
                  <div className="min-w-0">
                    <p className={cn("text-[12px] font-semibold leading-tight", styles.label)}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateLabel(item.date)}
                      <span className="mx-1 text-slate-300">•</span>
                      <span className={cn("font-medium", item.urgency === "overdue" ? "text-red-500" : item.urgency === "urgent" ? "text-amber-600" : "text-slate-500")}>
                        {daysLabel(item.daysUntil)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
