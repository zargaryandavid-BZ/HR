import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";
import { getEmployeeSessionFromRequest, signEmployeeToken, EMPLOYEE_COOKIE } from "@/lib/employee-session";

const HR_PROTECTED_PREFIXES = ["/dashboard", "/admin", "/manager", "/notifications"];

/** Middleware protecting authenticated routes and refreshing Supabase session */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Employee portal routes ────────────────────────────────────────────────
  if (pathname.startsWith("/employee")) {
    // Impersonation: HR Admin clicked "Open Employee Portal" — validate token, set session cookie
    const impersonateToken = request.nextUrl.searchParams.get("impersonate");
    if (impersonateToken && (pathname === "/employee/dashboard" || pathname === "/employee/dashboard/")) {
      return handleImpersonation(request, impersonateToken);
    }

    // Login page: if already authed → redirect to dashboard
    if (pathname === "/employee/login" || pathname === "/employee/login/") {
      const session = await getEmployeeSessionFromRequest(request);
      if (session) {
        return NextResponse.redirect(new URL("/employee/dashboard", request.url));
      }
      return NextResponse.next();
    }

    // All other /employee/* routes: require employee_session cookie
    const session = await getEmployeeSessionFromRequest(request);
    if (!session) {
      const loginUrl = new URL("/employee/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Validate the employee still exists (guards against stale sessions from deleted records)
    if (!pathname.startsWith("/api/")) {
      try {
        const validateUrl = new URL("/api/employee/auth/validate-session", request.url);
        const res = await fetch(validateUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: session.employeeId }),
        });
        if (!res.ok) {
          const loginUrl = new URL("/employee/login", request.url);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete(EMPLOYEE_COOKIE);
          return response;
        }
      } catch {
        // If validation fails, allow through — don't break the app
      }
    }

    return NextResponse.next();
  }

  // ── HR / Admin routes — Supabase auth ───────────────────────────────────
  return handleHrRouteAuth(request);
}

async function handleHrRouteAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.next({ request });
    }

    const { supabase, supabaseResponse } = createClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtected = HR_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}

/** Validate an impersonation token via an internal API call and set an employee session cookie */
async function handleImpersonation(request: NextRequest, token: string): Promise<NextResponse> {
  try {
    const validateUrl = new URL("/api/admin/employee/impersonate/validate", request.url);
    const res = await fetch(validateUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/employee/login?error=invalid_token", request.url));
    }

    const json = await res.json();
    const { employeeId, phone } = json.data as { employeeId: string; phone: string };

    // Sign a new employee session JWT and redirect to clean dashboard URL
    const sessionToken = await signEmployeeToken({ employeeId, phone });
    const response = NextResponse.redirect(new URL("/employee/dashboard", request.url));

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    response.headers.set(
      "Set-Cookie",
      `${EMPLOYEE_COOKIE}=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
    );

    return response;
  } catch {
    return NextResponse.redirect(new URL("/employee/login?error=invalid_token", request.url));
  }
}

export const config = {
  // api/employee/auth (including validate-session) is excluded to prevent loops
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/kiosk|kiosk|api/employee/auth|api/docs|api/admin/employee/impersonate/validate|candidate|api/candidate).*)",
  ],
};
