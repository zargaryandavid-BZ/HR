# Environment & Configuration

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Environment Variables

All environment variables are stored in `.env.local` (local development) or in the Vercel dashboard (production). The `.env.local` file is gitignored — never commit real secrets.

A reference list of variable names is maintained in `.env.vercel` at the project root.

### Database

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL pooled connection string (PgBouncer via Supabase) | `prisma/schema.prisma` |
| `DIRECT_URL` | **Yes** | PostgreSQL direct connection (bypasses PgBouncer) — required for migrations | `prisma/schema.prisma` |

**Format:**
```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

### Supabase Auth

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (e.g. `https://<ref>.supabase.co`) | `lib/supabase/*.ts`, browser auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key — safe to expose to browser | `lib/supabase/server.ts`, `client.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role secret — **never expose to browser** | `lib/supabase/admin.ts` only |

### Application

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Base URL of the deployed app (e.g. `https://hr.bazaarprinting.com`) | Welcome email links, OTP invite links, onboarding portal URLs |

### Employee Portal JWT

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `EMPLOYEE_SESSION_SECRET` | **Yes** | Secret key for signing HS256 JWTs | `lib/employee-session.ts` |

**Requirements:** Any sufficiently random string, at least 32 characters. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Default (insecure fallback):** If not set, falls back to `"employee-portal-jwt-secret-change-in-prod"`. This default **must not be used in production**.

### Twilio (SMS)

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Conditional | Twilio account SID | `lib/twilio.ts` |
| `TWILIO_AUTH_TOKEN` | Conditional | Twilio auth token | `lib/twilio.ts` |
| `TWILIO_PHONE_NUMBER` | Conditional | Twilio sending phone number (E.164 format: `+12025551234`) | `lib/twilio.ts` |

If any of the three are missing, SMS is silently skipped (warning logged). **Required in production** for employee portal login (OTP).

### Instantly (Email)

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `INSTANTLY_API_KEY` | Conditional | Instantly API key | `lib/instantly.ts` |
| `INSTANTLY_FROM_EMAIL` | Optional | From address (default: `hr@bazaarprinting.com`) | `lib/instantly.ts` |
| `INSTANTLY_FROM_NAME` | Optional | From name (default: `Bazaar Printing HR`) | `lib/instantly.ts` |

If `INSTANTLY_API_KEY` is missing, email is silently skipped (warning logged). **Required in production** for welcome emails and onboarding invites.

### Encryption

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `ENCRYPTION_KEY` | **Yes** (for identity docs) | 64-character hex string (32 bytes) for AES-256-CBC | `lib/utils/encryption.ts` |

Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important:** Changing this value after data has been encrypted will make all previously encrypted values unreadable. Store securely and back up.

### Cron Jobs

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `CRON_SECRET` | **Yes** (for cron) | Bearer token that cron callers must provide | `app/api/cron/*.ts` route handlers |

Cron routes validate: `request.headers.get("Authorization") === \`Bearer ${process.env.CRON_SECRET}\``

### Geofencing

| Variable | Required | Description | Used In |
|----------|----------|-------------|---------|
| `FACILITY_LAT` | Optional | Latitude of the facility (e.g. `33.9425`) | `lib/geofencing.ts` |
| `FACILITY_LNG` | Optional | Longitude of the facility (e.g. `-118.4081`) | `lib/geofencing.ts` |
| `GEOFENCE_RADIUS_M` | Optional | Radius in metres for GPS check (default: `50`) | `lib/geofencing.ts` |
| `OFFICE_STATIC_IP` | Optional | Static IP of the office network for IP-based validation | `lib/geofencing.ts` |

If none of these are set, clock-in is unrestricted (useful for development). See the geofencing priority logic in [docs/04-modules.md](./04-modules.md#module-2-time--attendance).

### Admin Script Variables

Only used by `prisma/create-admin.ts` (run via `npm run db:create-admin`). Never used at runtime.

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` | Email for the initial SUPER_ADMIN user |
| `ADMIN_PASSWORD` | Password for the initial SUPER_ADMIN user |
| `ADMIN_NAME` | Display name for the initial SUPER_ADMIN user |

### Node.js

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production`. Affects Supabase cookie `Secure` flag, Prisma logging. Set automatically by Next.js. |

---

## Environment Setup for Local Development

Create `.env.local` in the project root:

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Employee portal JWT
EMPLOYEE_SESSION_SECRET=<random-32-byte-hex>

# Encryption (for identity documents)
ENCRYPTION_KEY=<random-64-char-hex>

# Optional: Twilio (SMS) — leave blank to skip SMS in dev
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional: Instantly (email) — leave blank to skip email in dev
INSTANTLY_API_KEY=

# Optional: Geofencing — leave blank for unrestricted clock-in in dev
FACILITY_LAT=
FACILITY_LNG=
GEOFENCE_RADIUS_M=50
OFFICE_STATIC_IP=

# Cron (only needed if testing cron endpoints locally)
CRON_SECRET=dev-cron-secret
```

---

## Configuration Files

### `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"],
  // Prevents webpack bundling issues with Supabase in Next.js 15 serverless

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Build-time checks disabled for faster deploys (linting done separately)

  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      ]
    }]
  }
}
```

### `tsconfig.json`

Key settings:
- `"baseUrl": "."` — enables absolute imports from project root
- `"paths": { "@/*": ["./*"] }` — `@/` alias maps to the project root, e.g. `@/lib/auth` resolves to `lib/auth.ts`
- `"target": "ES2017"` — Node.js 18+ compatible output

### `postcss.config.mjs`

Configures Tailwind CSS v4 via `@tailwindcss/postcss`. No custom plugins.

### `eslint.config.mjs`

Extends `eslint-config-next` (Next.js recommended rules). Build ignores ESLint errors (`ignoreDuringBuilds: true` in `next.config.ts`).

### `.vercel/project.json`

Links the local repository to the Vercel project:
```json
{
  "orgId": "<vercel-org-id>",
  "projectId": "<vercel-project-id>"
}
```

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Start development server (hot reload) |
| `npm run dev:clean` | `rm -rf .next && next dev` | Clean build cache then start dev server |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Start production server |
| `npm run lint` | `next lint` | Run ESLint checks |
| `npm run db:push` | `dotenv -e .env.local -- prisma db push` | Push schema changes directly to DB (development, no migration file) |
| `npm run db:migrate` | `dotenv -e .env.local -- prisma migrate deploy` | Apply pending migrations to DB (production-safe) |
| `npm run db:verify-rls` | `dotenv -e .env.local -- npx tsx prisma/verify-rls.ts` | Verify all RLS policies are correctly applied |
| `npm run db:seed` | `dotenv -e .env.local -- npx tsx prisma/seed.ts` | Seed departments, leave types, accrual policies, holidays |
| `npm run db:seed-documents` | `dotenv -e .env.local -- npx tsx prisma/seed-documents.ts` | Seed initial document repository |
| `npm run db:create-admin` | `dotenv -e .env.local -- npx tsx prisma/create-admin.ts` | Create initial SUPER_ADMIN user (requires `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`) |

> All `db:*` scripts use `dotenv-cli` to load `.env.local` so they have access to `DATABASE_URL` without needing to export environment variables manually.

### Initial Setup Order

For a fresh environment:

```bash
# 1. Install dependencies
npm install

# 2. Set up .env.local with all required variables

# 3. Push schema to database (first deploy)
npm run db:migrate

# 4. Verify RLS policies
npm run db:verify-rls

# 5. Seed initial data
npm run db:seed
npm run db:seed-documents

# 6. Create the first admin user
npm run db:create-admin

# 7. Start development server
npm run dev
```

---

## Dependency Highlights

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.3.3 | Framework |
| `react` / `react-dom` | ^19.1.0 | UI library |
| `@prisma/client` | ^6.9.0 | Database ORM client |
| `@supabase/ssr` | ^0.6.1 | Supabase server-side auth |
| `@supabase/supabase-js` | ^2.50.0 | Supabase JS client |
| `@tanstack/react-query` | ^5.80.7 | Client-side data fetching and caching |
| `zustand` | ^5.0.5 | Lightweight client state |
| `jose` | ^6.2.3 | JWT signing and verification |
| `zod` | ^3.25.56 | Schema validation |
| `react-hook-form` | ^7.57.0 | Form state management |
| `@hookform/resolvers` | ^5.0.1 | Zod integration with react-hook-form |
| `twilio` | ^5.7.0 | SMS API |
| `pdf-lib` | ^1.17.1 | PDF generation |
| `qrcode` | ^1.5.4 | QR code generation |
| `html5-qrcode` | ^2.3.8 | QR code scanning |
| `@dnd-kit/core` + `sortable` | ^6.3.1 / ^10.0.0 | Drag-and-drop (onboarding step builder) |
| `date-fns` | ^4.1.0 | Date manipulation |
| `lucide-react` | ^0.513.0 | Icon library |
| `sonner` | ^2.0.7 | Toast notifications |
| `tailwind-merge` | ^3.3.0 | Tailwind class merging |
| `clsx` | ^2.1.1 | Conditional classnames |
| `class-variance-authority` | ^0.7.1 | Component variant styling |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `prisma` | Prisma CLI (migrations, generate) |
| `typescript` | TypeScript compiler |
| `tailwindcss` | CSS framework |
| `@tailwindcss/postcss` | PostCSS plugin for Tailwind 4 |
| `dotenv-cli` | Load `.env.local` in npm scripts |
| `eslint` + `eslint-config-next` | Linting |
