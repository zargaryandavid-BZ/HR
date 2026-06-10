"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/utils";
import { loginSchema } from "@/lib/validations";

export type LoginState = {
  error?: string;
};

/** Authenticate via Supabase on the server so session cookies are set correctly */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid credentials" };
  }

  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);

  if (authError) {
    return { error: authError.message };
  }

  const session = await getSession();

  if (!session) {
    await supabase.auth.signOut();
    return {
      error:
        "Your account is not set up in the HR system. Please contact your administrator.",
    };
  }

  if (session.role === "EMPLOYEE") {
    await supabase.auth.signOut();
    return {
      error: "Employees sign in at the Employee Portal using their phone number.",
    };
  }

  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  if (
    redirectTo &&
    redirectTo !== "/" &&
    !redirectTo.startsWith("/login") &&
    !redirectTo.startsWith("/employee/login")
  ) {
    redirect(redirectTo);
  }

  redirect(getDashboardPathForRole(session.role));
}
