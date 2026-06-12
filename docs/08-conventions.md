# Code Conventions & Patterns

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

This document describes the consistent patterns used throughout the codebase. AI agents and developers should follow these conventions when adding or modifying code.

---

## 1. API Response Envelope

**File:** `lib/api-response.ts`

Every API route must return a consistent JSON shape:

```typescript
type ApiResponse<T> = {
  data: T | null
  error: string | null
  message: string | null
}
```

### Building Responses

```typescript
import { apiSuccess, apiError } from "@/lib/api-response"

// Success response (wrap in Response.json())
return Response.json(apiSuccess(data))
return Response.json(apiSuccess(data, "Employee created successfully"), { status: 201 })

// Error response (apiError returns a full Response object)
return apiError("Not found", undefined, 404)
return apiError("Validation failed", "Phone number is invalid", 400)
return apiError("Unauthorized", undefined, 401)
return apiError("Internal server error", undefined, 500)
```

### Pagination

```typescript
import { getPaginationParams } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const { page, limit, skip } = getPaginationParams(request.nextUrl.searchParams)
  // page: starts at 1, clamped to >= 1
  // limit: clamped between 1 and 100, default 20
  // skip: (page - 1) * limit — ready to pass to Prisma
  const items = await prisma.employee.findMany({ skip, take: limit })
  return Response.json(apiSuccess({ items, page, limit }))
}
```

---

## 2. API Route Structure

Every route file exports HTTP method handler functions. Use this template:

```typescript
// app/api/<domain>/route.ts
import { NextRequest } from "next/server"
import { getSession } from "@/lib/auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError("Unauthorized", undefined, 401)

  try {
    const data = await prisma.<model>.findMany(...)
    return Response.json(apiSuccess(data))
  } catch (error) {
    console.error("[<domain>] GET error:", error)
    return apiError("Internal server error", undefined, 500)
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError("Unauthorized", undefined, 401)
  // Role check example:
  if (!isHrAdmin(session.role)) return apiError("Forbidden", undefined, 403)

  try {
    const body = await request.json()
    // Validate with Zod (see section 3)
    // ... business logic ...
    return Response.json(apiSuccess(created), { status: 201 })
  } catch (error) {
    console.error("[<domain>] POST error:", error)
    return apiError("Internal server error", undefined, 500)
  }
}
```

### Dynamic Route Segments

```typescript
// app/api/employees/[id]/route.ts
type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  // ...
}
```

---

## 3. Validation with Zod

**File:** `lib/validations.ts` — central schema definitions

### Validation Pattern in API Routes

```typescript
import { z } from "zod"

const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError("Unauthorized", undefined, 401)

  const body = await request.json()
  const parsed = createLeaveRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("Validation failed", parsed.error.errors[0]?.message, 400)
  }
  const { leaveTypeId, startDate, endDate, notes } = parsed.data
  // ...
}
```

### Key Schemas in `lib/validations.ts`

| Export | Validates |
|--------|----------|
| `employeeFormSchema` | Full employee creation/edit form |
| `EmployeeFormValues` | TypeScript type inferred from `employeeFormSchema` |
| `scheduleConfigSchema` | `Employee.scheduleConfig` JSON (CUSTOM / SHIFT_BASED / HOURS_BASED / FLEXIBLE) |
| `customScheduleConfigSchema` | CUSTOM schedule with per-day time slots |
| `companySettingsSchema` | `CompanySettings` update form |

### Client-Side Form Validation

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { employeeFormSchema, EmployeeFormValues } from "@/lib/validations"

const form = useForm<EmployeeFormValues>({
  resolver: zodResolver(employeeFormSchema),
  defaultValues: { ... }
})
```

---

## 4. Authentication Pattern in API Routes

### HR Portal Routes

```typescript
import { getSession, requireRole, isHrAdmin } from "@/lib/auth"

// Option 1: Any authenticated HR user
const session = await getSession()
if (!session) return apiError("Unauthorized", undefined, 401)

// Option 2: Specific roles only
const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"])
// requireRole redirects (throws) if unauthorized — use in server components

// Option 3: Manual role check (preferred in API routes — returns HTTP 403 instead of redirect)
const session = await getSession()
if (!session) return apiError("Unauthorized", undefined, 401)
if (!isHrAdmin(session.role)) return apiError("Forbidden", undefined, 403)
```

### Employee Portal Routes

```typescript
import { getEmployeeSession } from "@/lib/employee-session"

const session = await getEmployeeSession()
if (!session) return apiError("Unauthorized", undefined, 401)
const { employeeId } = session
// All subsequent queries must scope to employeeId — never trust a body param
```

---

## 5. Client-Side Data Fetching (TanStack React Query)

All client-side data fetching uses TanStack React Query v5. The `QueryClientProvider` is set up in `components/providers/QueryProvider.tsx` and applied in `app/layout.tsx`.

### Query Pattern

```typescript
import { useQuery } from "@tanstack/react-query"

function useEmployees(search?: string) {
  return useQuery({
    queryKey: ["employees", { search }],    // key must uniquely identify the request
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const res = await fetch(`/api/employees?${params}`)
      if (!res.ok) throw new Error("Failed to fetch employees")
      const json = await res.json()
      return json.data   // extract from ApiResponse envelope
    },
  })
}
```

### Mutation Pattern

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query"

function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: EmployeeFormValues) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Failed to create employee")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    },
  })
}
```

### Query Key Conventions

```
["employees"]                           — employee list
["employees", { search, status }]       — employee list with filters
["employee", id]                        — single employee
["leave-requests"]                      — leave request list
["leave-requests", { status }]          — filtered requests
["leave-balances", employeeId]          — per-employee balances
["documents"]                           — document repository
["time-entries", { employeeId, date }]  — timesheet
["notifications"]                       — notification list
["onboarding-instances"]                — onboarding list
```

### Current User Hook

```typescript
// lib/hooks/use-current-user.ts
import { useQuery } from "@tanstack/react-query"

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return null
      const json = await res.json()
      return json.data as AuthUser | null
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
}
```

---

## 6. Prisma Usage Patterns

### Singleton Client

```typescript
import { prisma } from "@/lib/prisma"
// Always import from here — never instantiate PrismaClient directly
```

### Transaction Pattern

Use `prisma.$transaction` for operations that must succeed or fail together:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const employee = await tx.employee.create({ data: { ... } })
  await tx.user.create({ data: { email: employee.workEmail, employeeId: employee.id, ... } })
  await createLeaveBalancesForEmployee(employee.id, currentYear, tx)
  return employee
})
// All operations above are rolled back if any throws
```

### Service functions accept optional `tx` parameter

Functions called inside transactions accept an optional Prisma transaction client:

```typescript
async function createLeaveBalancesForEmployee(
  employeeId: string,
  year: number,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma  // use transaction client if provided, otherwise global
  await client.leaveBalance.createMany({ ... })
}
```

---

## 7. Supabase File Upload Pattern

All file uploads follow this server-side pattern (never upload directly from browser to Supabase):

```typescript
// In an API route:
const supabase = createAdminClient()  // service role bypasses storage RLS

// 1. Parse the file from FormData
const formData = await request.formData()
const file = formData.get("file") as File
const buffer = Buffer.from(await file.arrayBuffer())

// 2. Determine storage path
const path = `employees/${employeeId}/${Date.now()}-${file.name}`

// 3. Upload
const { data, error } = await supabase.storage
  .from("documents")
  .upload(path, buffer, { contentType: file.type })

if (error) return apiError("Upload failed", error.message, 500)

// 4. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from("documents")
  .getPublicUrl(data.path)

// 5. Store URL in database
await prisma.documentAssignment.update({
  where: { id: assignmentId },
  data: { signedFileUrl: publicUrl }
})
```

---

## 8. Notification Creation Pattern

In-app notifications are created directly via Prisma. All notification creation uses this consistent pattern:

```typescript
await prisma.notification.create({
  data: {
    employeeId,                    // recipient employee's ID
    eventType: "LEAVE_APPROVED",   // string identifier for the event type
    channel: "IN_APP",
    status: "SENT",
    sentAt: new Date(),
    contentSnapshot: {             // JSON object — rendered by the UI
      message: "Your leave has been approved",
      href: "/employee/leave",     // optional: link to navigate when clicked
      // any additional context for rendering
    },
  },
})
```

For bulk notifications (e.g. notifying all HR admins):
```typescript
await prisma.notification.createMany({
  data: recipientEmployeeIds.map((employeeId) => ({
    employeeId,
    eventType: "LEAVE_PENDING_APPROVAL",
    channel: "IN_APP" as const,
    status: "SENT" as const,
    sentAt: new Date(),
    contentSnapshot: { message, href: "/admin/leave" },
  })),
})
```

---

## 9. Audit Logging Pattern

Sensitive operations are logged to the `AuditLog` table. Always log:
- Leave request approval/rejection/undo
- Document assignment/approval
- Employee deactivation
- Compensation changes
- Manual leave balance adjustments

```typescript
await prisma.auditLog.create({
  data: {
    userId: session.id,            // the HR user performing the action
    action: "LEAVE_REQUEST_APPROVED",
    targetId: leaveRequest.id,
    targetTable: "LeaveRequest",
    newValue: { status: "APPROVED", reviewedById: session.id },
    reason: "Approved by manager",
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  },
})
```

The `logLeaveAudit()` and `logDocumentAudit()` helper functions in their respective service files wrap this pattern.

---

## 10. Path Alias

All imports use the `@/` alias (maps to the project root via `tsconfig.json`):

```typescript
// Correct
import { prisma } from "@/lib/prisma"
import { apiSuccess } from "@/lib/api-response"
import { Button } from "@/components/ui/button"

// Incorrect (relative paths from deep files become unreadable)
import { prisma } from "../../../../lib/prisma"
```

---

## 11. Utility Functions (`lib/utils.ts`)

```typescript
import { cn, getDashboardPathForRole, formatEmployeeName } from "@/lib/utils"

// cn() — merge Tailwind classes, resolving conflicts
cn("px-4 py-2", "bg-blue-500", isActive && "bg-blue-700")

// getDashboardPathForRole() — redirect after auth
getDashboardPathForRole("HR_ADMIN")   // returns "/admin/dashboard"
getDashboardPathForRole("MANAGER")    // returns "/manager/dashboard"
getDashboardPathForRole("EMPLOYEE")   // returns "/employee/dashboard"

// formatEmployeeName() — preferred name fallback
formatEmployeeName("Jane", "Doe", "JD")  // returns "JD Doe" (preferred if set)
formatEmployeeName("Jane", "Doe", null)  // returns "Jane Doe"
```

---

## 12. Role Gate (Client Components)

Use `RoleGate` to conditionally render UI based on the current user's role:

```tsx
import { RoleGate } from "@/components/shared/RoleGate"

// Only renders children for HR_ADMIN and SUPER_ADMIN
<RoleGate allowedRoles={["HR_ADMIN", "SUPER_ADMIN"]}>
  <DeleteEmployeeButton />
</RoleGate>
```

Uses the `useCurrentUser()` hook internally. Renders nothing until the user data loads.

---

## 13. Toast Notifications (UI Feedback)

All user-facing action feedback uses `sonner` toasts:

```tsx
import { toast } from "sonner"

// Success
toast.success("Employee created successfully")

// Error
toast.error("Failed to save changes")

// Loading (returns a toast ID for later dismissal)
const id = toast.loading("Saving...")
toast.dismiss(id)
toast.success("Saved!", { id })
```

---

## 14. Adding a New Feature: Checklist

When adding a new domain feature, follow this checklist:

1. **Database:** Add model(s) to `prisma/schema.prisma` → run `npm run db:push` (dev) or create a migration
2. **Service layer:** Create `lib/<feature>/service.ts` with business logic and Prisma calls
3. **Validation:** Add Zod schema to `lib/validations.ts` or a local schema file
4. **API routes:** Create `app/api/<feature>/route.ts` (and `[id]/route.ts` as needed)
   - Use `apiSuccess` / `apiError` for all responses
   - Call `getSession()` / `getEmployeeSession()` at the top of every handler
   - Add role checks where appropriate
5. **UI components:** Create `components/<feature>/` for reusable pieces
6. **Pages:** Create `app/(dashboard)/admin/<feature>/page.tsx` (and employee portal equivalent if needed)
7. **Navigation:** Update `lib/navigation.ts` to add the new page to the sidebar
8. **Client hooks:** Create a React Query hook in `components/<feature>/use-<feature>.ts` or `lib/hooks/`
9. **Notifications:** Use the notification creation pattern (section 8) for any status-change events
10. **Audit log:** Add `auditLog.create()` calls for sensitive write operations
