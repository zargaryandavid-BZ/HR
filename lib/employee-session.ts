import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const EMPLOYEE_COOKIE = "employee_session";
const EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  return new TextEncoder().encode(
    process.env.EMPLOYEE_SESSION_SECRET ?? "employee-portal-jwt-secret-change-in-prod"
  );
}

export type EmployeeSessionPayload = {
  employeeId: string;
  phone: string;
};

/** Sign a new employee session JWT */
export async function signEmployeeToken(payload: EmployeeSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

/** Verify an employee session JWT — returns null on any failure */
export async function verifyEmployeeToken(
  token: string
): Promise<EmployeeSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as EmployeeSessionPayload;
  } catch {
    return null;
  }
}

/** Read and verify the employee session cookie from a server context */
export async function getEmployeeSession(): Promise<EmployeeSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(EMPLOYEE_COOKIE)?.value;
  if (!token) return null;
  return verifyEmployeeToken(token);
}

/** Read and verify the employee session cookie from a Next.js middleware request */
export async function getEmployeeSessionFromRequest(
  request: NextRequest
): Promise<EmployeeSessionPayload | null> {
  const token = request.cookies.get(EMPLOYEE_COOKIE)?.value;
  if (!token) return null;
  return verifyEmployeeToken(token);
}

/** Build a Set-Cookie header value for the session cookie */
export function buildSessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${EMPLOYEE_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${EXPIRY_SECONDS}${secure}`;
}

/** Build a cookie header that clears the session */
export function buildLogoutCookieHeader(): string {
  return `${EMPLOYEE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
