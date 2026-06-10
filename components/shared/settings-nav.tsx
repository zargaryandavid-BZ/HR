"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "@/lib/navigation";

/** Settings sub-navigation sidebar */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 w-full md:w-48 shrink-0">
      {SETTINGS_NAV.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href === "/admin/settings/positions" &&
            pathname.startsWith("/admin/settings/positions"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
