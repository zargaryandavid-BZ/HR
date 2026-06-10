import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/utils";
import { hasRole as hasRoleCheck, isHrAdmin, isManagerOrAbove } from "@/lib/roles";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  employeeId: string | null;
  mustChangePassword: boolean;
  employee?: {
    id: string;
    departmentId: string | null;
    firstName: string;
    lastName: string;
  } | null;
};

export { isHrAdmin, isManagerOrAbove };

/** Check if user has one of the allowed roles without redirecting */
export function hasRole(user: AuthUser | null, allowedRoles: Role[]): boolean {
  return hasRoleCheck(user?.role, allowedRoles);
}

/** Fetch the current Supabase session and linked app User record */
export async function getSession(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
    include: {
      employee: {
        select: {
          id: true,
          departmentId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId,
    mustChangePassword: user.mustChangePassword,
    employee: user.employee,
  };
}

/** Require authentication; redirect to login if not authenticated */
export async function requireAuth(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Require one of the specified roles; redirect to appropriate dashboard if unauthorized */
export async function requireRole(allowedRoles: Role[]): Promise<AuthUser> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    redirect(getDashboardPathForRole(session.role));
  }

  return session;
}

/** Verify a user's password without affecting their current session */
export async function verifyUserPassword(email: string, password: string): Promise<boolean> {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
