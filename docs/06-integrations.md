# External Integrations

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Integration Overview

| Service | Package / API | Purpose |
|---------|--------------|---------|
| **Supabase Auth** | `@supabase/ssr`, `@supabase/supabase-js` | HR user authentication (email/password) |
| **Supabase Storage** | `@supabase/supabase-js` (storage API) | File storage for documents, identity docs, uploads |
| **PostgreSQL** | Via Prisma | All application data |
| **Twilio** | `twilio` npm package | SMS OTP for employee portal login + onboarding/leave notifications |
| **Instantly** | REST API (`api.instantly.ai`) | Transactional email (welcome, onboarding invites, leave notifications) |
| **Vercel** | Hosting platform | Deployment, serverless functions, Cron Jobs |

---

## 1. Supabase

### 1.1 Supabase Auth

Supabase Auth handles HR user authentication only (not employee portal — see [docs/05-auth.md](./05-auth.md)).

**Setup:** The Supabase project is configured at `NEXT_PUBLIC_SUPABASE_URL` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side and `SUPABASE_SERVICE_ROLE_KEY` for server admin operations.

#### Client Factories (`lib/supabase/`)

| File | Client Type | Key | Usage |
|------|------------|-----|-------|
| `lib/supabase/server.ts` | `createClient()` | anon key | Server components, API routes — reads/writes session cookies |
| `lib/supabase/client.ts` | `createBrowserClient()` | anon key | Client components — browser auth operations |
| `lib/supabase/middleware.ts` | `createClient(request)` | anon key | Edge middleware — refreshes session cookies on every request |
| `lib/supabase/admin.ts` | `createAdminClient()` | service_role | Auth admin operations, Storage admin |

#### Auth Admin Operations (via `lib/supabase/admin.ts`)

The service-role admin client is used for:
- `supabase.auth.admin.createUser()` — during `createEmployee()` (bypasses email verification flow)
- `supabase.auth.admin.deleteUser()` — during employee deactivation
- `supabase.auth.admin.updateUserById()` — password resets
- Storage bucket operations requiring admin access

> Never expose the `SUPABASE_SERVICE_ROLE_KEY` to the browser. All `createAdminClient()` calls are server-only.

#### Session Refresh Pattern

`middleware.ts` calls `createClient(request)` (the middleware factory) on every request. This client reads the existing session cookie, verifies with Supabase, and if valid, returns an updated `supabaseResponse` that may contain refreshed cookies. Always return `supabaseResponse` from the middleware — never `NextResponse.next()` — to ensure session cookies are properly refreshed.

### 1.2 Supabase Storage

Supabase Storage provides S3-compatible file storage. All files are accessed via Supabase Storage URLs returned as `fileUrl` strings stored in the database.

#### Buckets

| Bucket | Purpose | Files Stored |
|--------|---------|-------------|
| `documents` | SOP/policy PDFs in the document repository | `Sop.fileUrl`, `DocumentAssignment.signedFileUrl` |
| `employee-documents` | Per-employee HR-generated documents | `GeneratedDocument.fileUrl` |
| `identity-documents` | Employee identity document files (SSN card, passport scan) | `EmployeeIdentityDocument.fileUrl` |
| `onboarding` | Files uploaded during onboarding steps | `OnboardingStepProgress.uploadedFileUrl` |

#### Storage Helpers

**File:** `lib/supabase/storage.ts` — base upload/download/signed URL helpers

Domain-specific wrappers:
- `lib/documents/storage.ts` — document repository uploads
- `lib/individual-settings/storage.ts` — HR-generated document files
- `lib/identity-documents/storage.ts` — identity document uploads
- `lib/onboarding/storage.ts` — onboarding file uploads

#### Upload Pattern

```typescript
// Example: Upload a signed document
const supabase = createAdminClient()
const { data, error } = await supabase.storage
  .from("documents")
  .upload(`employees/${employeeId}/${filename}`, fileBuffer, {
    contentType: "application/pdf",
    upsert: false,
  })

if (error) throw error

const { data: { publicUrl } } = supabase.storage
  .from("documents")
  .getPublicUrl(data.path)
// Store publicUrl in database as fileUrl
```

#### RLS on Storage

Storage buckets use Supabase Storage policies. The service-role client (`createAdminClient()`) bypasses all storage RLS, which is why all file operations go through server-side API routes — never directly from the browser.

### 1.3 Supabase PostgreSQL + RLS

See [docs/02-database.md](./02-database.md) for full details. Key integration point:

- All application data access uses Prisma with the `DATABASE_URL` (pooled connection)
- Prisma runs as the `postgres` superuser role — bypasses all RLS
- Supabase `anon` key is blocked from direct table access by RLS `DENY` policies
- This means the browser CANNOT query the database directly — all data access flows through Next.js API routes

---

## 2. Twilio (SMS)

**Package:** `twilio` v5.7  
**File:** `lib/twilio.ts`  
**Environment variables:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Function

```typescript
async function sendSms(to: string, body: string): Promise<boolean>
// Returns true on success, false if credentials missing or Twilio call fails
// Logs warning (not error) if credentials are not configured — allows dev without Twilio
```

### Usage Across the Codebase

| Location | Purpose |
|----------|---------|
| `app/api/employee/auth/send-otp/route.ts` | Send 6-digit OTP for portal login |
| `lib/employees.ts` | Welcome SMS on new employee creation |
| `lib/onboarding/service.ts` | Onboarding invite SMS |
| Leave approval routes | Leave status change SMS (in some configurations) |

### Fallback Behavior

If `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, or `TWILIO_PHONE_NUMBER` are not set, `sendSms()` logs a warning and returns `false` without throwing. The calling code treats `false` as a non-fatal error so the main operation (employee creation, OTP send) continues.

---

## 3. Instantly (Transactional Email)

**API:** REST (`https://api.instantly.ai/api/v1/unibox/emails/send`)  
**File:** `lib/instantly.ts`  
**Environment variables:** `INSTANTLY_API_KEY`, `INSTANTLY_FROM_EMAIL`, `INSTANTLY_FROM_NAME`

### Functions

#### `sendEmail(to, subject, htmlBody): Promise<boolean>`

Core function. Sends a transactional email via the Instantly API.

```typescript
async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean>
// Returns true if HTTP 200, false otherwise
// Logs warning if INSTANTLY_API_KEY is not set
```

#### `sendWelcomeEmail(email, name, tempPassword): Promise<boolean>`

Specialised wrapper that sends a pre-formatted welcome email to a new employee with their login URL and temporary password.

```typescript
async function sendWelcomeEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean>
```

### Usage Across the Codebase

| Location | Email Sent |
|----------|-----------|
| `lib/employees.ts` → `createEmployee()` | Welcome email with temporary password |
| `lib/onboarding/service.ts` → `sendOnboardingInvite()` | Onboarding portal invitation |
| `lib/onboarding/service.ts` → `notifyOnboardingCompletion()` | HR notification: employee completed onboarding |
| Various leave routes | Leave status change notifications |

### Fallback Behavior

If `INSTANTLY_API_KEY` is not set, `sendEmail()` logs a warning and returns `false`. All callers treat this as non-fatal.

---

## 4. Vercel

### Deployment

The application is deployed on Vercel (`.vercel/project.json` links the repository).

Key Next.js config settings in `next.config.ts` relevant to Vercel:
- `serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"]` — prevents webpack bundling of Supabase in edge/serverless contexts
- Security headers applied globally

### Cron Jobs

The two cron endpoints are designed to be triggered by Vercel Cron Jobs:

| Endpoint | Schedule (suggested) | Purpose |
|----------|---------------------|---------|
| `GET /api/cron/missed-clockouts` | Daily at midnight | Flag time entries still open at end of day |
| `GET /api/cron/year-end-rollover` | December 31 at 11 PM | Process year-end leave balance rollover |

**Authentication:** All cron requests must include `Authorization: Bearer <CRON_SECRET>` where `CRON_SECRET` matches the environment variable. The route handler verifies this header and returns `401` if it doesn't match.

**Vercel cron configuration** (example `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/missed-clockouts",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/year-end-rollover",
      "schedule": "0 23 31 12 *"
    }
  ]
}
```

Vercel automatically adds the `Authorization` header when calling cron routes if configured in the Vercel dashboard.

### Environment Variable Management

Environment variables are managed in the Vercel dashboard. The `.env.vercel` file at the project root serves as a reference list of variables that need to be configured in Vercel (it does not contain actual secret values).

---

## 5. pdf-lib

**Package:** `pdf-lib` v1.17  
**Usage:** Server-side PDF generation for offer letters and other HR-generated documents.

**Key locations:**
- `lib/individual-settings/` — PDF generation logic
- Generated files are uploaded to Supabase Storage and stored as `GeneratedDocument` records

---

## 6. QR Code Libraries

Two libraries are used for different sides of the QR workflow:

| Library | Usage |
|---------|-------|
| `qrcode` (server) | Generates QR code images from `Employee.qrCodeToken` — used in the HR portal to display/print employee QR codes |
| `html5-qrcode` (browser) | Scans QR codes via webcam in the admin clock scanner (`/admin/clock/scan`) and the kiosk UI |

**QR token storage:** `Employee.qrCodeToken` is a UUID generated at employee creation. It is embedded in the QR code and validated server-side during kiosk/scanner clock-in.

---

## 7. Browser Geolocation API

**File:** `lib/geofencing.ts`  
**Usage:** The browser's `navigator.geolocation.getCurrentPosition()` API is called client-side to capture GPS coordinates during clock-in. The coordinates are sent to the server (`POST /api/clock/in` with `{ coords: { lat, lng, accuracy } }`), where `validateClockInLocation()` performs the actual distance calculation. **The client is never trusted for the security decision.**

See [docs/04-modules.md#module-2-time--attendance](./04-modules.md) for the full geofencing logic.
