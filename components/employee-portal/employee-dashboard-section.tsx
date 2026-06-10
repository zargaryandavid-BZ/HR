"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type EmployeeDashboardSectionProps = {
  id?: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
};

/** Collapsible card wrapper for employee dashboard sections */
export function EmployeeDashboardSection({
  id,
  title,
  actions,
  children,
  className,
  contentClassName,
  defaultOpen = true,
}: EmployeeDashboardSectionProps) {
  const [visible, setVisible] = useState(defaultOpen);

  return (
    <section
      id={id}
      className={cn(
        "bg-white rounded-xl border",
        visible ? "p-5" : "px-5 py-3",
        className
      )}
    >
      <div className={cn("flex items-center justify-between gap-3", visible && "mb-4")}>
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {typeof title === "string" ? (
            <h2 className="text-base font-semibold">{title}</h2>
          ) : (
            title
          )}
          {actions}
        </div>
        <button
          type="button"
          onClick={() => setVisible((open) => !open)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={visible ? "Hide section" : "Show section"}
          aria-expanded={visible}
        >
          {visible ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {visible && <div className={contentClassName}>{children}</div>}
    </section>
  );
}
