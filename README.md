# Bazaar Printing HR Platform

Next.js 15 HR management platform with Supabase Auth, Prisma, and PostgreSQL.

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **UI:** shadcn/ui-style components, Lucide icons
- **Auth:** Supabase Auth
- **Database:** PostgreSQL via Supabase + Prisma ORM
- **Forms:** React Hook Form + Zod
- **State:** TanStack React Query, Zustand

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` with your Supabase, Twilio, and Instantly credentials (see `.cursorrules` for the full list).

### 3. Push database schema

```bash
npx prisma db push
```

### 4. Seed initial data (optional)

```bash
npx prisma db seed
```

### 5. Create Super Admin

1. Create a user in Supabase Auth dashboard
2. Insert a matching `User` row in the database with `role: SUPER_ADMIN`

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 1 Features

- Complete Prisma schema (17 models)
- Supabase authentication (login, reset password, forced password change)
- Role-based access control (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE)
- Employee management (list, create, detail, deactivate)
- Department, company settings, leave types, holidays, location zones
- App shell with role-based navigation and notification bell

## Project Structure

```
app/
  (auth)/          # Login, reset password, change password
  (dashboard)/     # Protected routes with app shell
    admin/         # HR Admin pages
    manager/       # Manager pages
    employee/      # Employee pages
  api/             # REST API routes
components/
  ui/              # shadcn-style UI primitives
  shared/          # App shell, RoleGate, page headers
  employees/       # Employee form components
lib/
  auth.ts          # Session and role helpers
  prisma.ts        # Database client
  supabase/        # Supabase clients
  validations.ts   # Zod schemas
prisma/
  schema.prisma    # Full database schema
```

## Development Phases

See the development guide for Phases 2–6 (Time Management, Leave, Onboarding/SOPs, Reporting, Advanced Features).
