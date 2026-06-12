# Authentication & Authorization

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Overview: Dual Authentication System

The application runs two completely separate authentication systems in parallel, serving different user populations.

```
┌─────────────────────────────────────────────────────────────────────┐
│  HR / Admin / Manager Portal                                        │
│                                                                     │
│  User visits /login                                                 │
│      ↓                                                              │
│  Email + password form → Supabase Auth (createClient().signIn())    │
│      ↓                                                              │
│  Supabase sets cookie(s) in response                                │
│      ↓                                                              │
│  middleware.ts verifies session on every request to /dashboard,     │
│  /admin, /manager, /notifications                                   │
│      ↓                                                              │
│  API routes call getSession() → Supabase user → Prisma User lookup  │
│      ↓                                                              │
│  Role-based access via requireRole([...])                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Employee Self-Service Portal                                       │
│                                                                     │
│  Employee visits /employee/login                                    │
│      ↓                                                              │
│  Selects their name from list → enters phone number                 │
│      ↓                                                              │
│  POST /api/employee/auth/send-otp → Twilio sends 6-digit SMS        │
│      ↓                                                              │
│  POST /api/employee/auth/verify-otp → validates OTP in EmployeeOTP  │
│      ↓                                                              │
│  signEmployeeToken({ employeeId, phone }) → HS256 JWT              │
│      ↓                                                              │
│  Set-Cookie: employee_session=<JWT>; HttpOnly; SameSite=Lax         │
│      ↓                                                              │
│  middleware.ts verifies cookie on every /employee/* request         │
│      ↓                                                              │
│  API routes call getEmployeeSession() → { employeeId, phone }       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: HR Portal Authentication (Supabase)

### Entry Point

**File:** `app/(auth)/login/page.tsx`  
**API call:** Supabase client `auth.signInWithPassword({ email, password })`

### Session Verification

**File:** `lib/supabase/server.ts` — creates a server-side Supabase client that reads cookies.

**File:** `lib/auth.ts` — the main auth helper module.

#### `getSession(): Promise<AuthUser | null>`

Combines Supabase Auth and Prisma in one call:

```typescript
async function getSession(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
    include: { employee: { select: { id, departmentId, firstName, lastName } } }
  })
  if (!user) return null

  return { id, email, name, role, employeeId, mustChangePassword, employee }
}
```

#### `requireAuth(): Promise<AuthUser>`

Calls `getSession()`. If null, calls `redirect("/login")`. Used in server components and API routes.

#### `requireRole(allowedRoles: Role[]): Promise<AuthUser>`

Calls `requireAuth()`, then checks the returned user's role against the allowed list. If not in the list, redirects to the role's default dashboard (`getDashboardPathForRole(role)`).

```typescript
async function requireRole(allowedRoles: Role[]): Promise<AuthUser>
// Throws redirect() if not authenticated or wrong role
```

#### `verifyUserPassword(email, password): Promise<boolean>`

Creates a temporary Supabase client with `persistSession: false` and attempts sign-in. Used for sensitive re-authentication without affecting the current session.

### `AuthUser` Type

```typescript
type AuthUser = {
  id: string              // Prisma User.id
  email: string
  name: string | null
  role: Role              // SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE
  employeeId: string | null
  mustChangePassword: boolean
  employee?: {
    id: string
    departmentId: string | null
    firstName: string
    lastName: string
  } | null
}
```

---

## Part 2: Employee Portal Authentication (JWT)

### Entry Point

**File:** `app/employee/login/page.tsx`  
**OTP flow:** Phone number → Twilio SMS → verify code → JWT cookie

### JWT Implementation

**File:** `lib/employee-session.ts`

| Constant | Value |
|----------|-------|
| Cookie name | `employee_session` |
| Algorithm | HS256 (via `jose`) |
| Expiry | 30 days |
| Secret | `EMPLOYEE_SESSION_SECRET` env var |

#### `signEmployeeToken(payload): Promise<string>`

Creates a signed HS256 JWT containing `{ employeeId, phone }`.

#### `verifyEmployeeToken(token): Promise<EmployeeSessionPayload | null>`

Verifies the JWT signature and expiry. Returns `null` on any failure (expired, tampered, missing).

#### `getEmployeeSession(): Promise<EmployeeSessionPayload | null>`

Reads the `employee_session` cookie from the Next.js server cookie store (used in API route handlers and server components).

#### `getEmployeeSessionFromRequest(request): Promise<EmployeeSessionPayload | null>`

Same as above but reads from a `NextRequest` object (used in middleware).

### OTP Flow Detail

```
1. GET /api/employee/auth/employees
   → Returns list: [{ id, firstName, lastName, phone }]
   → UI lets employee select their name

2. POST /api/employee/auth/send-otp { phone }
   → Generates 6-digit random code
   → Stores in EmployeeOTP { phone, code, expiresAt: now + 10min }
   → Calls sendSms(phone, code) via Twilio
   → Returns { sent: true }

3. POST /api/employee/auth/verify-otp { phone, code }
   → Finds EmployeeOTP where phone=phone AND code=code AND expiresAt>now AND usedAt IS NULL
   → If not found: return 400
   → Sets EmployeeOTP.usedAt = now (single use)
   → Finds Employee by phone
   → signEmployeeToken({ employeeId: employee.id, phone })
   → Set-Cookie: employee_session=<JWT>
   → Returns { employeeId }

4. On subsequent requests: middleware.ts reads cookie → verifyEmployeeToken()
```

---

## Part 3: Middleware Route Protection

**File:** `middleware.ts`

### Protected Route Groups

```typescript
// HR portal: these prefixes require a Supabase session
const HR_PROTECTED_PREFIXES = ["/dashboard", "/admin", "/manager", "/notifications"]

// Employee portal: all /employee/* routes require employee_session cookie
// Exception: /employee/login and /api/employee/auth/* are public
```

### Middleware Exclusions (matcher)

The middleware runs on all routes **except**:
- `_next/static` and `_next/image` — Next.js static assets
- `favicon.ico`
- `/api/kiosk` — unauthenticated kiosk clock
- `kiosk` — kiosk UI
- `/api/employee/auth` — OTP auth endpoints (would cause loops)
- `/api/docs` — public document share links
- `/api/admin/employee/impersonate/validate` — called by middleware itself

### HR Route Auth Flow

```typescript
async function handleHrRouteAuth(request): Promise<NextResponse> {
  const { supabase, supabaseResponse } = createClient(request)  // refreshes session cookie
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = HR_PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    redirect to /login?redirect=<pathname>
  }

  return supabaseResponse  // always return to refresh Supabase session cookies
}
```

### Employee Route Auth Flow

```typescript
// 1. Check for impersonation token
if (pathname === "/employee/dashboard" && searchParams.has("impersonate")) {
  return handleImpersonation(request, token)
}

// 2. Allow login page if not authed; redirect to dashboard if already authed
if (pathname === "/employee/login") { ... }

// 3. All other /employee/* routes: require cookie
const session = await getEmployeeSessionFromRequest(request)
if (!session) redirect to /employee/login?redirect=<pathname>

// 4. Validate employee still exists (guards against deactivated accounts)
POST /api/employee/auth/validate-session { employeeId: session.employeeId }
if (!ok) clear cookie + redirect to /employee/login
```

---

## Part 4: Role Hierarchy

**Enum:** `Role` in `prisma/schema.prisma`

| Role | Description | Default Dashboard |
|------|-------------|------------------|
| `SUPER_ADMIN` | Full platform access; same as HR_ADMIN for most features | `/admin/dashboard` |
| `HR_ADMIN` | Full HR access: employees, leave, documents, settings, onboarding | `/admin/dashboard` |
| `MANAGER` | Read team data, approve leave, view timesheet, reports | `/manager/dashboard` |
| `EMPLOYEE` | Self-service: time, leave, documents, onboarding | `/employee/dashboard` |

### Role Check Helpers

**File:** `lib/roles.ts`

```typescript
function isHrAdmin(role?: Role): boolean
// Returns true for SUPER_ADMIN and HR_ADMIN

function isManagerOrAbove(role?: Role): boolean
// Returns true for SUPER_ADMIN, HR_ADMIN, and MANAGER

function hasRole(role: Role | undefined, allowedRoles: Role[]): boolean
// Returns true if role is in the allowedRoles array
```

### Client-Side Role Gate

**File:** `components/shared/RoleGate.tsx`

```tsx
<RoleGate allowedRoles={["HR_ADMIN", "SUPER_ADMIN"]}>
  <AdminOnlyContent />
</RoleGate>
```

Uses the `useCurrentUser()` hook (which fetches `/api/auth/me`) to determine the current user's role and conditionally renders children.

---

## Part 5: Impersonation

**Purpose:** Allows HR admins to view the employee portal as a specific employee for troubleshooting.

**Models:** `EmployeeImpersonationToken`

### Flow

```
1. HR admin on /admin/employees/[id]:
   → Clicks "Open Employee Portal"
   → POST /api/admin/employee/impersonate { employeeId }
   → Creates EmployeeImpersonationToken { token: uuid, employeeId, expiresAt: now+15min }
   → Returns { token }

2. UI opens window: /employee/dashboard?impersonate=<TOKEN>

3. middleware.ts intercepts:
   → POST /api/admin/employee/impersonate/validate { token }
   → Validates: token exists, not expired, not usedAt
   → Sets token.usedAt = now (single use)
   → Returns { employeeId, phone }
   → signEmployeeToken({ employeeId, phone })
   → Set-Cookie: employee_session=<JWT>
   → Redirect to /employee/dashboard (removes ?impersonate from URL)

4. HR admin now sees the employee portal as that employee
   → All /api/employee/* calls are authenticated as that employee
```

### Security Properties

- Tokens are **single-use** (`usedAt` field prevents replay)
- Tokens are **short-lived** (typically 15 minutes via `expiresAt`)
- Only users with `SUPER_ADMIN` or `HR_ADMIN` role can create tokens (enforced in the create API route)
- The validate endpoint is excluded from middleware to prevent loops

---

## Part 6: Forced Password Change

**Field:** `User.mustChangePassword` (Boolean, default `false`)

New employees have `mustChangePassword: true` set during `createEmployee()`.

### Enforcement Flow

```
1. User logs in via /login (Supabase Auth succeeds)
2. getSession() returns user with mustChangePassword: true
3. app/page.tsx checks mustChangePassword
   → if true: redirect to /change-password
4. POST /api/auth/change-password { currentPassword, newPassword }
   → verifyUserPassword() re-authenticates
   → supabase.auth.updateUser({ password: newPassword })
   → prisma.user.update({ mustChangePassword: false })
5. User redirected to role dashboard
```

---

## Part 7: Supabase Client Factories

**Directory:** `lib/supabase/`

| File | Export | Usage |
|------|--------|-------|
| `server.ts` | `createClient()` | Server components and API routes; reads/writes cookies |
| `client.ts` | `createBrowserClient()` | Client components; browser-side auth operations |
| `admin.ts` | `createAdminClient()` | Service-role operations: `auth.admin.*`, Storage admin |
| `middleware.ts` | `createClient(request)` | Middleware: refreshes Supabase session cookies |
| `storage.ts` | Bucket helpers | Upload/download/delete in Supabase Storage |

**Environment variables required:**
- `NEXT_PUBLIC_SUPABASE_URL` — used by all clients
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by browser and server clients
- `SUPABASE_SERVICE_ROLE_KEY` — used only by admin client
