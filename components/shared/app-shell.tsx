"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { cn, getDashboardPathForRole } from "@/lib/utils";
import { getNavItemsForRole, getNavGroupsForRole } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/shared/notification-bell";
import { Skeleton } from "@/components/ui/skeleton";

type AppShellProps = {
  children: React.ReactNode;
};

/** Main application layout with sidebar navigation and header */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading, error } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && error) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, error, pathname, router]);

  const navItems = role ? getNavItemsForRole(role) : [];
  const navGroups = role ? getNavGroupsForRole(role) : [];

  const { data: activeOnboarding } = useQuery({
    queryKey: ["active-onboarding-nav"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/instances/active");
      const json = await res.json();
      return json.data as { id: string } | null;
    },
    enabled: role === "EMPLOYEE",
  });

  const { data: leavePendingCount } = useQuery({
    queryKey: ["leave-stats-badge"],
    queryFn: async () => {
      const res = await fetch("/api/leave/stats");
      const json = await res.json();
      return (json.data?.pendingCount ?? 0) as number;
    },
    enabled: role === "HR_ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER",
    refetchInterval: 60_000,
  });

  const { data: docBadgeCount } = useQuery({
    queryKey: ["employee-documents-unack-count"],
    queryFn: async () => {
      const res = await fetch("/api/employee/documents/unacknowledged-count");
      const json = await res.json();
      return (json.data?.count ?? 0) as number;
    },
    enabled: role === "EMPLOYEE",
  });

  const { data: employeeCount } = useQuery({
    queryKey: ["employees-count"],
    queryFn: async () => {
      const res = await fetch("/api/employees/count");
      const json = await res.json();
      return (json.data?.count ?? 0) as number;
    },
    enabled: role === "HR_ADMIN" || role === "SUPER_ADMIN",
    refetchInterval: 60_000,
  });

  /** Resolve inline label counts for nav items */
  function getInlineCount(path?: string): number | null {
    if (!path) return null;
    if (path === "/api/employees/count") return employeeCount ?? null;
    return null;
  }

  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresActiveOnboarding) {
      return !!activeOnboarding?.id;
    }
    return true;
  }).map((item) => {
    if (item.requiresActiveOnboarding && activeOnboarding?.id) {
      return { ...item, href: `/employee/onboarding/${activeOnboarding.id}` };
    }
    return item;
  });

  /** Resolve badge counts for nav items */
  function getBadgeCount(path?: string): number {
    if (!path) return 0;
    if (path === "/api/leave/stats") return leavePendingCount ?? 0;
    if (path === "/api/employee/documents/unacknowledged-count") return docBadgeCount ?? 0;
    return 0;
  }

  /** Check whether a nav item matches the current route */
  function isNavItemActive(href: string): boolean {
    if (href === "/admin/leave") return pathname === "/admin/leave";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  /** Sign out and redirect to login */
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <Skeleton className="w-64 h-full shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const displayName = user?.name ?? user?.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-5 border-b">
        {!collapsed && (
          <Link href={role ? getDashboardPathForRole(role) : "/"} className="font-bold text-lg">
            Bazaar HR
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href);
          const badgeCount = getBadgeCount(item.badgeCountPath);
          const inlineCount = getInlineCount(item.inlineCountPath);
          const label =
            inlineCount !== null ? `${item.label} (${inlineCount})` : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={cn(
                        "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        item.badgeCountPath === "/api/leave/stats"
                          ? isActive
                            ? "bg-white/20 text-primary-foreground"
                            : "bg-amber-100 text-amber-700"
                          : "bg-destructive text-destructive-foreground"
                      )}
                    >
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupHrefs = group.items.map((item) => item.href);
          const activeGroupHref = groupHrefs
            .filter(
              (href) => pathname === href || pathname.startsWith(`${href}/`)
            )
            .sort((a, b) => b.length - a.length)[0];
          return (
            <div key={group.label} className="pt-2">
              {!collapsed && (
                <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                  <GroupIcon className="h-3 w-3" />
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeGroupHref === item.href;
                const subBadgeCount = getBadgeCount(item.badgeCountPath);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ml-0",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {!collapsed && (
                      <>
                        <span className="pl-2 flex-1">{item.label}</span>
                        {subBadgeCount > 0 && (
                          <span
                            className={cn(
                              "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                              isActive
                                ? "bg-white/20 text-primary-foreground"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {subBadgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex min-h-0 flex-col overflow-hidden border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col overflow-hidden bg-card">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {(role === "HR_ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium"
                  onClick={() =>
                    window.open(
                      "/clock-station",
                      "clock-station",
                      "width=480,height=780,toolbar=no,menubar=no,scrollbars=no,resizable=yes"
                    )
                  }
                >
                  <span>🕐</span>
                  Clock Station
                </Button>
                <a
                  href="/employee/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Employee Portal
                </a>
              </>
            )}
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={
                    role === "HR_ADMIN" || role === "SUPER_ADMIN"
                      ? "/admin/profile"
                      : role === "MANAGER"
                        ? "/admin/profile"
                        : "/employee/profile"
                  }>My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content — sole vertical scroll region for dashboard pages */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-8 lg:p-6 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
