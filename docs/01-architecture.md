# Architecture & Project Structure

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Overview

The application is a **monolithic Next.js 15 App Router** project. There is no separate backend server — all API logic lives in Next.js route handlers under `app/api/`. The architecture follows a **feature-module + service-layer** pattern:

```
Browser / Employee Device
        │
        ▼
┌───────────────────────────────┐
│   Next.js App Router (app/)   │  ← Pages (RSC) + API Route Handlers
│                               │
│  app/(dashboard)/...  pages   │
│  app/employee/...     pages   │
│  app/api/...          routes  │
└──────────────┬────────────────┘
               │ imports
               ▼
┌───────────────────────────────┐
│   Service Layer (lib/)        │  ← Business logic, validation, helpers
│                               │
│  lib/employees.ts             │
│  lib/leave/service.ts         │
│  lib/time/hours-worked.ts     │
│  lib/onboarding/service.ts    │
│  ... 89 TypeScript files      │
└──────────────┬────────────────┘
               │ queries via
               ▼
┌───────────────────────────────┐
│   Prisma ORM (lib/prisma.ts)  │  ← Singleton PrismaClient
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│   PostgreSQL (Supabase)       │  ← 37 models, RLS enabled
└───────────────────────────────┘

External services (called from lib/):
  Supabase Auth  ←→  lib/supabase/
  Twilio SMS     ←→  lib/twilio.ts
  Instantly Mail ←→  lib/instantly.ts
  Supabase Storage ←→ lib/supabase/storage.ts
```

---

## Full Directory Tree

```
/Users/davitz/Documents/GitHub/HR/
│
├── app/                          # Next.js App Router root
│   ├── layout.tsx                # Root layout — wraps app with QueryClientProvider
│   ├── page.tsx                  # Root redirect → role dashboard or /login
│   ├── globals.css               # Global CSS (Tailwind base styles)
│   │
│   ├── (auth)/                   # HR authentication pages (no AppShell)
│   │   ├── login/page.tsx        # Email/password login (Supabase)
│   │   ├── reset-password/page.tsx
│   │   └── change-password/page.tsx  # Forced change on mustChangePassword flag
│   │
│   ├── (dashboard)/              # Protected HR pages wrapped in AppShell
│   │   ├── layout.tsx            # AppShell layout with sidebar nav
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx       # KPI cards, pending actions
│   │   │   ├── employees/               # List, new, and detail pages
│   │   │   ├── timesheet/page.tsx       # HR admin timesheet view
│   │   │   ├── leave/page.tsx           # Leave request management
│   │   │   ├── leave-balances/page.tsx  # All employee balances
│   │   │   ├── documents/               # Document repository
│   │   │   ├── notifications/page.tsx
│   │   │   ├── clock/scan/page.tsx      # QR scanner clock-in
│   │   │   ├── onboarding/page.tsx      # Active onboardings
│   │   │   ├── offboarding/page.tsx     # Active offboardings
│   │   │   ├── settings/                # Company/dept/position/leave type/holiday settings
│   │   │   └── profile/page.tsx
│   │   ├── manager/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── presence/page.tsx        # Team live presence board
│   │   │   ├── timesheet/page.tsx
│   │   │   ├── leave/page.tsx           # Approve/reject team leave
│   │   │   ├── calendar/page.tsx        # Team leave calendar
│   │   │   ├── onboarding/page.tsx
│   │   │   └── reports/page.tsx
│   │   └── employee/                    # Dashboard-embedded employee views
│   │       ├── dashboard/page.tsx
│   │       ├── time/page.tsx
│   │       ├── leave/page.tsx
│   │       ├── documents/page.tsx
│   │       ├── onboarding/page.tsx
│   │       └── profile/page.tsx
│   │
│   ├── employee/                  # Standalone employee self-service portal (OTP auth)
│   │   ├── login/page.tsx         # Phone OTP login
│   │   ├── dashboard/page.tsx     # Employee home
│   │   ├── time/page.tsx          # Clock in/out, time history
│   │   ├── leave/page.tsx         # Leave requests and balances
│   │   ├── documents/page.tsx     # Assigned documents
│   │   ├── onboarding/page.tsx    # Onboarding tasks
│   │   ├── profile/page.tsx       # View/edit personal info
│   │   └── portal-preview/[employeeId]/page.tsx  # HR preview of employee portal
│   │
│   ├── clock-station/             # Kiosk / clock station (unauthenticated)
│   │   └── page.tsx
│   │
│   ├── docs/[token]/              # Public document share link viewer
│   │   └── page.tsx
│   │
│   └── api/                       # 142 REST route handlers
│       ├── auth/                  # /api/auth/me, /api/auth/change-password
│       ├── employee/              # /api/employee/* — employee self-service
│       ├── clock/                 # /api/clock/* — portal clock in/out/break
│       ├── kiosk/                 # /api/kiosk/clock — unauthenticated kiosk
│       ├── employees/             # /api/employees/* — HR employee CRUD
│       ├── leave/                 # /api/leave/* — leave requests and balances
│       ├── documents/             # /api/documents/* — document repository
│       ├── onboarding/            # /api/onboarding/* — flows and instances
│       ├── offboarding/           # /api/offboarding/* — offboarding flows
│       ├── departments/           # /api/departments/*
│       ├── positions/             # /api/positions/*
│       ├── holidays/              # /api/holidays/*
│       ├── notifications/         # /api/notifications/*
│       ├── settings/              # /api/settings/* — company/position/leave settings
│       ├── admin/                 # /api/admin/* — HR admin tools, KPIs, impersonation
│       ├── dashboard/             # /api/dashboard/important-dates
│       ├── docs/                  # /api/docs/[token] — share link access
│       ├── cron/                  # /api/cron/* — scheduled jobs
│       └── health/                # /api/health — health check
│
├── components/                    # 104 React UI components
│   ├── ui/                        # shadcn-style Radix primitives
│   │   └── button.tsx, dialog.tsx, input.tsx, select.tsx, tabs.tsx, toast.tsx, ...
│   ├── shared/                    # Cross-cutting layout and auth components
│   │   ├── AppShell.tsx           # Sidebar + top bar layout wrapper
│   │   ├── RoleGate.tsx           # Client-side role-based rendering gate
│   │   ├── PageHeader.tsx         # Consistent page title/action header
│   │   ├── NotificationBell.tsx   # In-app notification indicator
│   │   └── SettingsNav.tsx        # Settings section sidebar nav
│   ├── providers/
│   │   └── QueryProvider.tsx      # TanStack React Query client provider
│   ├── admin/                     # Admin dashboard and leave management components
│   ├── employees/                 # Employee detail forms and sub-sections
│   ├── employee-portal/           # Employee self-service portal UI sections
│   ├── documents/                 # Document cards, assign/notify modals
│   ├── onboarding/                # Onboarding wizard, step builder, step renderer
│   └── timesheet/                 # Clock widgets, QR scanner, live clock board
│
├── lib/                           # 89 TypeScript business logic files
│   ├── prisma.ts                  # Singleton PrismaClient
│   ├── auth.ts                    # Supabase session + Prisma user, requireAuth/requireRole
│   ├── roles.ts                   # Role check helpers (isHrAdmin, isManagerOrAbove)
│   ├── employee-session.ts        # Employee portal JWT cookie helpers
│   ├── api-response.ts            # apiSuccess / apiError / getPaginationParams
│   ├── validations.ts             # Zod schemas for employees, settings, etc.
│   ├── navigation.ts              # Role-based sidebar nav config
│   ├── employees.ts               # Employee CRUD orchestration
│   ├── employees/                 # Sub-modules: activity, break-schedule, notes, etc.
│   ├── accrual.ts                 # Accrual policy helpers
│   ├── accrual/                   # run-accrual.ts, backfill logic
│   ├── leave/                     # service.ts, balances.ts, working-days.ts
│   ├── time/                      # hours-worked.ts, missed-clockout.ts
│   ├── breaks/                    # CA break entitlements and scheduling
│   ├── breaks.ts                  # Break helpers
│   ├── documents/                 # service.ts, storage.ts, document assignment logic
│   ├── document-share/            # Token-based external document sharing
│   ├── onboarding/                # service.ts, storage.ts, invite helpers
│   ├── offboarding/               # service.ts, offboarding flow logic
│   ├── individual-settings/       # Per-employee HR docs, PDF generation, audit
│   ├── identity-documents/        # SSN/passport storage, masking, encryption
│   ├── notifications.ts           # Notification creation helpers
│   ├── notifications/             # Portal request topic helpers
│   ├── admin/                     # Dashboard KPI aggregation
│   ├── geofencing.ts              # GPS/IP clock-in validation
│   ├── twilio.ts                  # sendSms()
│   ├── instantly.ts               # sendEmail(), sendWelcomeEmail()
│   ├── yearEndRollover.ts         # Year-end leave balance processing
│   ├── utils/
│   │   └── encryption.ts          # AES-256-CBC encrypt/decrypt
│   ├── utils.ts                   # cn() classnames, getDashboardPathForRole, etc.
│   ├── supabase/                  # Supabase client factories
│   │   ├── server.ts              # Server-side Supabase client
│   │   ├── client.ts              # Browser-side Supabase client
│   │   ├── admin.ts               # Service-role admin client
│   │   ├── middleware.ts          # Middleware Supabase client (cookie refresh)
│   │   └── storage.ts             # Supabase Storage helpers
│   └── hooks/
│       └── use-current-user.ts    # Client hook → GET /api/auth/me
│
├── prisma/
│   ├── schema.prisma              # 37 models, 30+ enums, datasource config
│   ├── migrations/                # 3 SQL migration files
│   │   ├── 20250608000000_enable_row_level_security/
│   │   ├── 20250609000000_enable_rls_additional_tables/
│   │   └── 20250610000000_document_assignment_sent_at/
│   ├── seed.ts                    # Seed: depts, leave types, accrual policies, holidays
│   ├── seed-documents.ts          # Seed: document repository
│   ├── create-admin.ts            # Create SUPER_ADMIN user
│   ├── verify-rls.ts              # Verify RLS policies are active
│   └── sql/verify-rls.sql
│
├── public/                        # Favicon, icons
├── scripts/
│   └── fix-duplicates.mjs         # Data cleanup utility script
├── middleware.ts                   # Next.js edge middleware (route protection)
├── next.config.ts                  # Next.js config (security headers, external packages)
├── tsconfig.json                   # TypeScript config — @/* alias maps to project root
├── postcss.config.mjs              # PostCSS for Tailwind 4
├── eslint.config.mjs               # ESLint config
└── package.json                    # Dependencies + npm scripts
```

---

## Routing Conventions

### App Router Route Groups

| Route Group | Path | Purpose | Auth |
|-------------|------|---------|------|
| `(auth)` | `/login`, `/reset-password`, `/change-password` | HR login flows | None (redirects if already authed) |
| `(dashboard)` | `/admin/*`, `/manager/*`, `/employee/*` | All HR-facing protected pages | Supabase session required |
| `employee/` | `/employee/*` | Employee self-service portal | `employee_session` JWT cookie |
| `clock-station/` | `/clock-station` | Kiosk | None |
| `docs/[token]/` | `/docs/:token` | Public share links | Token-based |

### API Route File Convention

Each API route handler lives at:
```
app/api/<domain>/[optionalId]/route.ts
```

Handlers export HTTP method functions: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`.

Example structure of a route file:
```typescript
import { NextRequest } from "next/server"
import { getSession } from "@/lib/auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError("Unauthorized", undefined, 401)
  // ... business logic
  return Response.json(apiSuccess(data))
}
```

---

## Component Categories

| Category | Location | Purpose |
|----------|----------|---------|
| **Primitives** | `components/ui/` | Unstyled Radix-based building blocks (Button, Dialog, Input, Select, Tabs, Toast, etc.) |
| **Layout** | `components/shared/AppShell.tsx` | Persistent sidebar + top navigation for all dashboard pages |
| **Auth guards** | `components/shared/RoleGate.tsx` | Client-side conditional rendering based on user role |
| **Feature UI** | `components/admin/`, `components/employees/`, etc. | Domain-specific forms, tables, modals |
| **Employee Portal** | `components/employee-portal/` | Components used exclusively in the `/employee/*` portal |
| **Providers** | `components/providers/QueryProvider.tsx` | Wraps app with TanStack Query client |

---

## Data Flow: Creating a Leave Request

This example traces the full stack for a common operation:

```
1. Employee submits form in components/employee-portal/LeaveRequestForm.tsx
        │
        ▼
2. React Hook Form validates against Zod schema
        │
        ▼
3. TanStack Query mutation → POST /api/employee/leave/request
        │
        ▼
4. app/api/employee/leave/request/route.ts
   - getEmployeeSession() verifies JWT cookie
   - Parses request body
   - Calls prisma.leaveRequest.create()
   - Calls lib/leave/service.ts → notifyLeaveStatusChange()
        │
        ▼
5. Prisma writes LeaveRequest row to PostgreSQL
        │
        ▼
6. lib/notifications.ts creates Notification row for HR
        │
        ▼
7. Response: { data: leaveRequest, error: null, message: null }
        │
        ▼
8. React Query cache invalidated → UI updates
```

---

## Security Headers

Configured in `next.config.ts` for all routes:

```
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'self'
```

The `@supabase/supabase-js` and `@supabase/ssr` packages are declared as `serverExternalPackages` to avoid webpack bundling issues in Next.js 15.
