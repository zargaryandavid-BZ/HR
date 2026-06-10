"use client";

import { Suspense, useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { getDashboardPathForRole } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorMessage } from "@/components/shared/page-header";

type MeResponse = {
  role: "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE";
};

const initialState: LoginState = {};

const URL_ERROR_MESSAGES: Record<string, string> = {
  not_linked:
    "Your account is not set up in the HR system. Please contact your administrator.",
};

/** Login form with redirect handling */
function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const urlError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  /** Redirect in the background if already signed in */
  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (cancelled || !meRes.ok) return;

        const meJson = await meRes.json();
        const me = meJson.data as MeResponse;
        if (me.role === "EMPLOYEE") return;

        window.location.href =
          redirect &&
          redirect !== "/" &&
          !redirect.startsWith("/login") &&
          !redirect.startsWith("/employee/login")
            ? redirect
            : getDashboardPathForRole(me.role);
      } catch {
        // Keep the login form visible
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [redirect]);

  const displayError =
    state.error ?? (urlError ? URL_ERROR_MESSAGES[urlError] ?? null : null);

  return (
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bazaar Printing HR</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <form action={formAction}>
          <input type="hidden" name="redirect" value={redirect} />
          <CardContent className="space-y-4">
            {displayError && <ErrorMessage message={displayError} />}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@bazaarprinting.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in..." : "Sign in"}
            </Button>
            <Link
              href="/reset-password"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Forgot password?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

/** Email/password login page */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">Loading...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
