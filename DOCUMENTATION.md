# Bazaar Printing HR Platform — Master Documentation Index

> **Purpose of this file:** This is the single entry point for understanding the entire codebase. It is written for external AI agents, new developers, and automated tooling. Every section links to a dedicated detail document in the [`/docs`](./docs/) folder.

---

## Project Summary

**Bazaar Printing HR** is a full-stack HR management platform built with **Next.js 15 App Router**, **Prisma ORM**, and **PostgreSQL** (hosted on Supabase). It manages the complete employee lifecycle: hiring, onboarding, daily time tracking, leave management, document compliance, disciplinary records, and offboarding — for both HR administrators and employees via a self-service portal.

The system operates two distinct user-facing surfaces:
1. **HR / Admin / Manager portal** — authenticated via Supabase email/password
2. **Employee self-service portal** — authenticated via phone SMS OTP → custom JWT cookie

---

## Quick-Reference Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.3 |
| UI | React + Tailwind CSS + Radix UI | 19 / 4 |
| Language | TypeScript | 5.8 |
| Database | PostgreSQL (Supabase-hosted) | — |
| ORM | Prisma | 6.9 |
| HR Auth | Supabase Auth (`@supabase/ssr`) | 0.6 |
| Employee Auth | Custom JWT via `jose` | 6.2 |
| Forms | React Hook Form + Zod | 7.57 / 3.25 |
| Client State | TanStack React Query + Zustand | 5 / 5 |
| SMS | Twilio | 5.7 |
| Email | Instantly API | REST |
| PDF | pdf-lib | 1.17 |
| QR | html5-qrcode + qrcode | — |
| Deployment | Vercel | — |

---

## Scale at a Glance

| Metric | Count |
|--------|-------|
| Prisma database models | 37 |
| REST API routes | 142 |
| Application pages | 50 |
| `lib/` TypeScript service files | 89 |
| UI components | 104 |
| SQL migrations | 3 |
| Enums | 30+ |

---

## Documentation Index

| # | File | Contents |
|---|------|---------|
| 1 | [Architecture & Structure](./docs/01-architecture.md) | Directory tree, tech stack, layered architecture diagram, routing, component categories |
| 2 | [Database & Data Models](./docs/02-database.md) | All 37 Prisma models, 30+ enums, relationships, RLS security model, migrations |
| 3 | [API Routes Reference](./docs/03-api-routes.md) | All 142 REST endpoints grouped by domain, auth requirements, request/response shape |
| 4 | [Feature Modules](./docs/04-modules.md) | Each business domain module — key files, core exported functions, purpose |
| 5 | [Authentication & Authorization](./docs/05-auth.md) | Dual auth system, role hierarchy, middleware, impersonation, forced password change |
| 6 | [External Integrations](./docs/06-integrations.md) | Supabase, Twilio, Instantly, Vercel, Supabase Storage, cron jobs |
| 7 | [Environment & Configuration](./docs/07-environment.md) | All environment variables, config files, NPM scripts |
| 8 | [Code Conventions & Patterns](./docs/08-conventions.md) | API envelope, validation, client fetching, upload pattern, audit logging, notifications |

---

## Top-Level Directory Map

```
/
├── app/                    # Next.js App Router — pages and API route handlers
│   ├── (auth)/             # HR login, reset-password, change-password
│   ├── (dashboard)/        # Protected HR/manager/employee dashboard pages
│   ├── employee/           # Standalone employee self-service portal (OTP auth)
│   ├── clock-station/      # Kiosk clock-in UI (unauthenticated)
│   ├── docs/[token]/       # Public document share link viewer
│   └── api/                # 142 REST API route handlers
├── components/             # 104 React UI components
│   ├── ui/                 # shadcn-style Radix primitives
│   ├── shared/             # AppShell, RoleGate, PageHeader, NotificationBell
│   ├── admin/              # Admin dashboard cards, leave management
│   ├── employees/          # Employee forms, identity docs, compensation
│   ├── employee-portal/    # Employee-facing dashboard sections
│   ├── documents/          # Document cards, assign/notify modals
│   ├── onboarding/         # Wizard, step builder, step renderer
│   └── timesheet/          # Clock widgets, QR scanner, live board
├── lib/                    # 89 TypeScript service/utility files (business logic)
├── prisma/                 # schema.prisma, migrations/, seed scripts
├── public/                 # Static assets
├── scripts/                # Utility scripts (fix-duplicates.mjs)
├── middleware.ts            # Route protection (Supabase + employee JWT)
├── next.config.ts           # Next.js config
├── tsconfig.json            # TypeScript config (@/* path alias)
└── package.json             # Dependencies + npm scripts
```

---

## Key Entry Points for AI Agents

| Task | Starting Point |
|------|---------------|
| Add a new API endpoint | `app/api/` — follow existing route file structure; use `apiSuccess`/`apiError` from `lib/api-response.ts` |
| Add a new database model | `prisma/schema.prisma` → run `npm run db:push` or `npm run db:migrate` |
| Add a new feature module | Create `lib/<feature>/` service file + `app/api/<feature>/` routes + `components/<feature>/` UI |
| Change auth behavior | `middleware.ts` (route protection), `lib/auth.ts` (server helpers), `lib/employee-session.ts` (employee JWT) |
| Understand a database relationship | See [docs/02-database.md](./docs/02-database.md) |
| Understand all API endpoints | See [docs/03-api-routes.md](./docs/03-api-routes.md) |
| Set up a development environment | See [docs/07-environment.md](./docs/07-environment.md) |
