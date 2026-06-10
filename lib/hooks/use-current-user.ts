"use client";

import { useQuery } from "@tanstack/react-query";
import { Role } from "@prisma/client";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  employeeId: string | null;
  departmentId: string | null;
  mustChangePassword: boolean;
};

/** Fetch the current authenticated user from the API */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser> => {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch user");
      return json.data;
    },
    staleTime: 60_000,
  });

  return {
    user: query.data ?? null,
    role: query.data?.role ?? null,
    employeeId: query.data?.employeeId ?? null,
    departmentId: query.data?.departmentId ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
