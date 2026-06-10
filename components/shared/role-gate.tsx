"use client";

import { Role } from "@prisma/client";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

type RoleGateProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Render children only when the current user has an allowed role */
export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
}: RoleGateProps) {
  const { role, isLoading } = useCurrentUser();

  if (isLoading) return null;
  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
