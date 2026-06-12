# Feature Modules

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

This document describes every major business domain module. Each module is implemented as a combination of:
- **Service files** in `lib/` — business logic and database access
- **API route handlers** in `app/api/` — HTTP interface
- **UI components** in `components/` — React presentation layer
- **Page components** in `app/` — Next.js App Router pages

---

## Module 1: Employee Management

**Purpose:** The central module. Manages the full employee record including personal info, employment details, compensation, schedule, and lifecycle actions (create, deactivate).

### Key Files

| File | Purpose |
|------|---------|
| `lib/employees.ts` | Core orchestration: `createEmployee()`, `buildEmployeeWhereClause()` |
| `lib/employees/personal-info.ts` | Helper: `buildAddressBirthdateData()` — maps form values to Prisma input |
| `lib/employees/employee-number.ts` | Helper: `generateEmployeeNumber()` — auto-increments sequential employee numbers |
| `lib/employees/activity.ts` | Activity log queries for the employee detail page |
| `lib/employees/break-schedule.ts` | Break schedule and waiver configuration per employee |
| `lib/validations.ts` | `EmployeeFormValues` Zod schema |
| `app/api/employees/route.ts` | GET (list) / POST (create) |
| `app/api/employees/[id]/route.ts` | GET (detail) / PATCH (update) |
| `app/api/employees/[id]/deactivate/route.ts` | POST — deactivate |
| `components/employees/` | Employee forms and detail sub-sections |

### Core Functions

#### `createEmployee(input, assignedByUserId)`
**File:** `lib/employees.ts`

Full employee provisioning in a single atomic transaction plus post-transaction side effects:

1. **Transaction** (`prisma.$transaction`):
   - Creates `Employee` record with all form data + generated `qrCodeToken` + `employeeNumber`
   - Creates linked `User` record with `mustChangePassword: true`
   - Calls `createLeaveBalancesForEmployee()` — seeds all leave type balances for current year
   - Calls `seedCompanyWideDocumentAssignments()` — assigns all COMPANY_WIDE documents
   - Calls `seedAutomationDocumentAssignments()` — assigns position-specific documents (if `positionId` set)
2. **Post-transaction:**
   - Creates Supabase Auth user with temporary password via `supabase.auth.admin.createUser()`
   - Sends welcome email via `sendWelcomeEmail()` (Instantly)
   - Sends welcome SMS via `sendSms()` (Twilio) if phone provided

```typescript
async function createEmployee(
  input: EmployeeFormValues & { role?: Role },
  assignedByUserId: string
): Promise<Employee>
```

#### `buildEmployeeWhereClause(params)`
**File:** `lib/employees.ts`

Builds a `Prisma.EmployeeWhereInput` object from query parameters.

```typescript
function buildEmployeeWhereClause(params: {
  search?: string;       // searches firstName, lastName, workEmail, preferredName
  departmentId?: string;
  status?: string;       // "ACTIVE" | "INACTIVE"
}): Prisma.EmployeeWhereInput
```

---

## Module 2: Time & Attendance

**Purpose:** Manages all clock in/out activity, break tracking, geofence validation, and timesheet administration.

### Key Files

| File | Purpose |
|------|---------|
| `lib/time/hours-worked.ts` | `calculateHours()` — net hours excluding break time |
| `lib/time/missed-clockout.ts` | `detectAndFlagMissedClockOuts()` — cron job logic |
| `lib/time/overtime.ts` | Overtime calculation for non-exempt employees |
| `lib/time/accrual-trigger.ts` | Triggers leave accrual calculation after clock-out |
| `lib/breaks.ts` | Break scheduling and duration helpers |
| `lib/breaks/` | CA-specific break entitlement rules (10-min rest, 30-min meal) |
| `lib/geofencing.ts` | `validateClockInLocation()`, `haversineMetres()`, `extractClientIp()` |
| `app/api/clock/` | Clock in/out/break route handlers |
| `app/api/kiosk/clock/route.ts` | Unauthenticated kiosk clock handler |
| `app/api/admin/clock/` | Live board + QR scan routes |
| `app/api/admin/time-entries/` | Admin timesheet CRUD + export |
| `components/timesheet/` | Clock widgets, QR scanner, live clock board |
| `app/clock-station/page.tsx` | Kiosk UI |

### Core Functions

#### `validateClockInLocation(clientIp, coords)`
**File:** `lib/geofencing.ts`

Server-side location validation. Never trusts client-provided data for the actual security decision.

```typescript
function validateClockInLocation(
  clientIp: string,
  coords: GpsCoords | null | undefined
): LocationValidationResult
// Returns: { allowed: boolean, reason?: string, method?: "GPS" | "IP" | "UNCONFIGURED" }
```

**Validation priority:**
1. If GPS coords provided AND `FACILITY_LAT`/`FACILITY_LNG` configured → Haversine distance check
2. If no GPS AND `OFFICE_STATIC_IP` configured → IP comparison
3. Neither configured → unrestricted (development / unconfigured)

#### `haversineMetres(lat1, lng1, lat2, lng2)`
**File:** `lib/geofencing.ts`

Great-circle distance between two GPS coordinates in metres (Earth radius = 6,371,000 m).

#### `detectAndFlagMissedClockOuts()`
**File:** `lib/time/missed-clockout.ts`

Called by the `/api/cron/missed-clockouts` cron route. Finds all `TimeEntry` records with status `IN_PROGRESS` or `ON_BREAK` that are past end-of-day; updates their status to `FLAGGED`.

#### Clock-in Flow (Portal)

```
POST /api/clock/in
  1. getEmployeeSession() → verify JWT cookie
  2. validateClockInLocation() → GPS/IP check
  3. Check no existing open TimeEntry for employee
  4. prisma.timeEntry.create({ status: IN_PROGRESS, clockInMethod: PORTAL })
  5. Return { data: timeEntry }
```

---

## Module 3: Leave Management

**Purpose:** Full leave request lifecycle — submission, approval, balance tracking, PTO/sick accrual, and year-end rollover.

### Key Files

| File | Purpose |
|------|---------|
| `lib/leave/service.ts` | `notifyLeaveStatusChange()`, `notifyLeaveRequestSubmitted()`, `logLeaveAudit()`, `markLeaveApprovalNotificationsRead()` |
| `lib/leave/balances.ts` | `createLeaveBalancesForEmployee()`, `seedLeaveBalancesForAllEmployees()` |
| `lib/leave/working-days.ts` | `calculateWorkingDays()` — excludes weekends and holidays; `formatDateRange()` |
| `lib/leave/important-dates.ts` | Queries for upcoming dates related to leave |
| `lib/accrual.ts` | Accrual policy helpers and validators |
| `lib/accrual/run-accrual.ts` | `processAccrual()`, `runAccrualForEmployee()` |
| `lib/yearEndRollover.ts` | `processYearEndRollover()` — cron job logic |
| `app/api/leave/` | Leave request CRUD + approval workflow |
| `app/api/admin/run-accrual/route.ts` | Manual accrual trigger |
| `app/api/cron/year-end-rollover/route.ts` | Year-end cron handler |

### Core Functions

#### `notifyLeaveStatusChange({ employeeId, leaveTypeName, startDate, endDate, status, reviewNote })`
**File:** `lib/leave/service.ts`

Creates an in-app `Notification` for the employee when a leave request is approved, rejected, or HR-added.

#### `notifyLeaveRequestSubmitted({ leaveRequestId, employeeId, leaveTypeName, startDate, endDate })`
**File:** `lib/leave/service.ts`

Notifies all HR admins (SUPER_ADMIN, HR_ADMIN) and department managers when an employee submits a new leave request. Uses `prisma.notification.createMany()` for batch insert.

#### `logLeaveAudit({ userId, action, targetId, newValue, reason })`
**File:** `lib/leave/service.ts`

Writes an `AuditLog` entry for leave actions (approve/reject/undo/adjust).

#### `createLeaveBalancesForEmployee(employeeId, year, tx?)`
**File:** `lib/leave/balances.ts`

Creates a `LeaveBalance` record for every active `LeaveType` for a given employee and year. Called inside the `createEmployee()` transaction.

#### `processAccrual()` / `runAccrualForEmployee(employeeId)`
**File:** `lib/accrual/run-accrual.ts`

Scans uncredited `TimeEntry` records for an employee, calculates PTO and sick hours earned based on the position's `AccrualPolicy` (e.g. 1 hour earned per 30 hours worked), updates `LeaveBalance.accrualHoursEarned` and `accrualHoursWorked`, and appends a `LeaveAccrualLog` entry.

#### Leave Approval Flow

```
POST /api/leave/requests/[id]/approve
  1. requireRole([HR_ADMIN, SUPER_ADMIN, MANAGER])
  2. Load LeaveRequest with employee and leaveType
  3. Validate status === PENDING
  4. prisma.$transaction:
     - Update LeaveRequest status → APPROVED, set reviewedById, reviewedAt
     - Update LeaveBalance: usedDays += workingDays, pendingDays -= workingDays
  5. notifyLeaveStatusChange() → in-app notification
  6. logLeaveAudit()
  7. markLeaveApprovalNotificationsRead()
```

---

## Module 4: Documents & SOPs

**Purpose:** Company document repository with assignment, acknowledgment tracking, signed upload workflow, HR approval, and external share links.

### Key Files

| File | Purpose |
|------|---------|
| `lib/documents/service.ts` | `syncDocumentScopeAssignments()`, `notifyHrAdminsDocumentAwaitingApproval()`, `getUnacknowledgedDocumentCount()`, `logDocumentAudit()` |
| `lib/documents/assignments.ts` | `seedCompanyWideDocumentAssignments()`, `seedAutomationDocumentAssignments()` |
| `lib/documents/storage.ts` | Supabase Storage helpers for document files |
| `lib/document-share/` | Token generation, validation, and link management for external share links |
| `lib/individual-settings/` | Per-employee HR-generated documents, PDF generation |
| `app/api/documents/` | Document repository CRUD |
| `app/api/employees/[id]/documents/` | Per-employee assignment, send, approve, share link routes |
| `app/api/employee/documents/` | Employee portal: list assigned docs, upload signed version |
| `components/documents/` | Document cards, assign modals, notify modals |

### Core Functions

#### `syncDocumentScopeAssignments(documentId, positionIds, departmentIds, assignedByUserId)`
**File:** `lib/documents/service.ts`

When a document's scope changes, this function reconciles `DocumentAssignment` records — adding assignments for newly in-scope employees and (optionally) removing for out-of-scope ones.

#### `notifyHrAdminsDocumentAwaitingApproval(employeeId, documentTitle, assignedByUserId)`
**File:** `lib/documents/service.ts`

Creates in-app notifications for all HR admins when an employee uploads a signed document. Redirects HR to the document approval page.

#### `getUnacknowledgedDocumentCount(employeeId)`
**File:** `lib/documents/service.ts`

Returns the count of `DocumentAssignment` records where `acknowledgedAt IS NULL` and `sentAt IS NOT NULL` for a given employee. Used for the notification badge.

#### `seedCompanyWideDocumentAssignments(employeeId, assignedByUserId, tx?)`
**File:** `lib/documents/assignments.ts`

Called during `createEmployee()`. Assigns all active `COMPANY_WIDE` scoped `Sop` documents to the new employee.

#### `seedAutomationDocumentAssignments(employeeId, positionId, assignedByUserId, tx?)`
**File:** `lib/documents/assignments.ts`

Called during `createEmployee()` if positionId is set. Assigns all position-specific documents linked via `DocumentPositionLink`.

#### Document Sign + Upload Flow

```
Employee uploads signed document:
  POST /api/employee/documents/[id]/upload
    1. Upload file to Supabase Storage
    2. Update DocumentAssignment: signedFileUrl, signedAt
    3. notifyHrAdminsDocumentAwaitingApproval()
    4. completeDocumentSignStepsForUpload() — advances any matching onboarding DOCUMENT_SIGN step

HR approves uploaded document:
  POST /api/employees/[id]/documents/[docId]/approve
    1. Update DocumentAssignment: hrApprovedAt, hrApprovedBy
    2. Update SopAcknowledgment: acknowledgedAt
```

---

## Module 5: Onboarding & Offboarding

**Purpose:** Structured, sequential onboarding and offboarding workflows per job position. Steps can require form submissions, document signing, surveys, or file uploads.

### Key Files

| File | Purpose |
|------|---------|
| `lib/onboarding/service.ts` | `createOnboardingInstance()`, `completeOnboardingStep()`, `sendOnboardingInvite()`, `notifyOnboardingCompletion()`, `completeDocumentSignStepsForUpload()` |
| `lib/onboarding/instance-status.ts` | `isOnboardingInProgress()` — checks if a meaningful step is in progress |
| `lib/onboarding/types.ts` | TypeScript types for step config shapes (e.g. `DocumentSignStepConfig`) |
| `lib/onboarding/task-types.ts` | Step type display metadata |
| `lib/onboarding/tasks.ts` | Employee-facing task list queries |
| `lib/onboarding/flow-documents.ts` | Document references within flow steps |
| `lib/onboarding/audit.ts` | Audit log helpers for onboarding events |
| `lib/onboarding/storage.ts` | Supabase Storage helpers for onboarding file uploads |
| `lib/offboarding/` | Mirror of `lib/onboarding/` for offboarding flows |
| `components/onboarding/` | Wizard, step builder (drag-and-drop via `@dnd-kit`), step renderer |

### Core Functions

#### `createOnboardingInstance(employeeId, templateId, triggeredByUserId)`
**File:** `lib/onboarding/service.ts`

Starts an onboarding flow for an employee:
1. Validates template exists and is active
2. Checks no conflicting active instance exists for the employee
3. Creates `OnboardingInstance` with status `IN_PROGRESS`
4. Creates `OnboardingStepProgress` for every step: first step → `AVAILABLE`, rest → `LOCKED`
5. Appends an audit log entry

```typescript
async function createOnboardingInstance(
  employeeId: string,
  templateId: string,
  triggeredByUserId: string
): Promise<OnboardingInstance & { stepProgress: ..., template: ..., employee: ... }>
```

#### `completeOnboardingStep(instanceId, stepId, responseData, employeeId)`
**File:** `lib/onboarding/service.ts`

Advances an onboarding step in a transaction:
1. Validates the instance belongs to the employee and is not already completed
2. Validates the step is `AVAILABLE` or `IN_PROGRESS`
3. Updates the step to `COMPLETED`; saves `responseData` and `uploadedFileUrl`
4. Unlocks the next step (`LOCKED` → `AVAILABLE`)
5. If no next step: marks instance as `COMPLETED`, calls `notifyOnboardingCompletion()`

#### `sendOnboardingInvite(employee, positionName, stepCount, instanceId)`
**File:** `lib/onboarding/service.ts`

Sends email (via Instantly) and SMS (via Twilio) to the employee with the onboarding portal URL.

#### `completeDocumentSignStepsForUpload(employeeId, payload)`
**File:** `lib/onboarding/service.ts`

Cross-module integration: when an employee uploads a signed document, this function automatically completes any matching `DOCUMENT_SIGN` step in the employee's active onboarding instance.

#### Step Type Configuration (`config` JSON field on `OnboardingStep`)

| Step Type | Config Fields |
|-----------|--------------|
| `FORM` | `{ fields: [{ name, label, type, required }] }` |
| `DOCUMENT_SIGN` | `{ documentId: string, documentTitle: string }` |
| `SURVEY` | `{ questions: [{ id, text, type, options? }] }` |
| `FILE_UPLOAD` | `{ label: string, accept: string }` |

---

## Module 6: Notifications

**Purpose:** In-app notification system. Notifications are created by service layer code and displayed in the `NotificationBell` component. External channels (email/SMS) are handled by Twilio and Instantly directly.

### Key Files

| File | Purpose |
|------|---------|
| `lib/notifications.ts` | Core creation helpers (used across all modules) |
| `lib/notifications/` | Portal-specific notification topics (portal requests) |
| `components/shared/NotificationBell.tsx` | Bell icon with unread badge in AppShell |
| `app/api/notifications/` | List + mark-read routes (HR portal) |
| `app/api/employee/notifications/` | List + mark-read routes (employee portal) |

### Notification Pattern

All in-app notifications follow the same creation pattern:

```typescript
await prisma.notification.create({
  data: {
    employeeId,                     // recipient
    eventType: "LEAVE_APPROVED",    // free-text event identifier
    channel: "IN_APP",
    status: "SENT",
    sentAt: new Date(),
    contentSnapshot: {              // JSON payload for UI rendering
      message: "Your leave has been approved",
      href: "/employee/leave",      // optional navigation link
    },
  },
})
```

### Event Types Used

| `eventType` | Trigger |
|-------------|---------|
| `LEAVE_APPROVED` | Leave request approved |
| `LEAVE_REJECTED` | Leave request rejected |
| `LEAVE_HR_ADDED` | HR recorded leave on behalf of employee |
| `LEAVE_PENDING_APPROVAL` | Employee submitted a leave request (sent to HR/manager) |
| `ONBOARDING_COMPLETED` | Employee completed all onboarding steps |
| `DOCUMENT_AWAITING_APPROVAL` | Employee uploaded signed document |
| `PORTAL_REQUEST` | Employee sent a message/request via portal |

---

## Module 7: Admin Dashboard

**Purpose:** Aggregated KPIs and action items for the HR admin home page.

### Key Files

| File | Purpose |
|------|---------|
| `lib/admin/` | Dashboard KPI queries |
| `app/api/admin/dashboard/kpis/route.ts` | GET — returns all dashboard metrics |
| `components/admin/dashboard/` | KPI cards and pending action lists |
| `app/(dashboard)/admin/dashboard/page.tsx` | Admin dashboard page |

### KPIs Returned

- Total active employee headcount
- Active onboarding instances count
- Pending leave request count
- Employees with expiring identity documents
- Employees with unacknowledged documents
- Upcoming team important dates

---

## Module 8: Identity Documents & Encryption

**Purpose:** Stores sensitive employee identity documents (SSN, passport, etc.) with AES-256-CBC encryption for document numbers.

### Key Files

| File | Purpose |
|------|---------|
| `lib/identity-documents/` | CRUD, masking, and encryption helpers for identity documents |
| `lib/utils/encryption.ts` | `encrypt()` / `decrypt()` — AES-256-CBC |
| `app/api/employees/[id]/identity-documents/` | List and create routes |

### Core Functions

#### `encrypt(plainText)`
**File:** `lib/utils/encryption.ts`

Encrypts sensitive text (e.g. SSN) using AES-256-CBC with a random 16-byte IV.

```typescript
function encrypt(plainText: string): string
// Returns: "ivHex:encryptedHex" format
```

Requires: `ENCRYPTION_KEY` env var — must be a 64-character hex string (32 bytes).

#### `decrypt(encryptedString)`
**File:** `lib/utils/encryption.ts`

Decrypts an `"ivHex:encryptedHex"` formatted string.

#### Masking

SSN numbers are stored encrypted. When returned to the UI, only the last 4 digits are shown (e.g. `***-**-1234`). Full decryption is only performed in specific admin contexts.

---

## Module 9: Settings

**Purpose:** Company-wide configuration managed by HR admins.

### Key Files

| File | Purpose |
|------|---------|
| `app/api/settings/company/route.ts` | Company settings (overtime threshold, rollover policy, etc.) |
| `app/api/departments/` | Department CRUD |
| `app/api/settings/positions/` | Position CRUD + accrual policy + flow builder |
| `app/api/settings/leave-types/` | Leave type management |
| `app/api/settings/holidays/` | Holiday management |
| `app/api/settings/location-zones/` | Geofence zone management |
| `app/(dashboard)/admin/settings/` | All settings pages |

### Accrual Policy Settings

Each `Position` can have one `AccrualPolicy`. Key parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `hoursWorkedPerAccrual` | 30 | Hours worked to earn 1 accrual unit |
| `hoursEarnedPerAccrual` | 1 | Hours earned per accrual unit |
| `ptoAccrualCapHours` | 120 | Maximum PTO hours that can be accrued |
| `ptoRolloverCapHours` | 40 | Max hours that carry over at year-end |
| `sickAccrualCapHours` | 80 | Maximum sick hours accrual cap |
| `usableAfterDays` | 90 | Waiting period before accrued leave can be used |

---

## Module 10: Manager Features

**Purpose:** Managers have a restricted view of their team — they can view presence, approve leave, and see onboarding status, but cannot edit HR data.

### Key Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/manager/` | All manager pages |
| `lib/roles.ts` | `isManagerOrAbove()` — used in API routes to grant manager access to certain resources |

### Manager-Accessible Resources

| Resource | Access Level |
|---------|-------------|
| Employee list | Read-only (own department) |
| Live presence board | Read |
| Timesheet | Read + approve entries |
| Leave requests | Approve/reject (own team) |
| Team calendar | Read |
| Onboarding status | Read |
| Reports | Export |

---

## Module 11: Impersonation

**Purpose:** HR admins can preview the employee portal as any employee for troubleshooting.

### Key Files

| File | Purpose |
|------|---------|
| `app/api/admin/employee/impersonate/route.ts` | Creates impersonation token |
| `app/api/admin/employee/impersonate/validate/route.ts` | Validates and consumes token |
| `middleware.ts` | Intercepts `?impersonate=TOKEN` on `/employee/dashboard` |

### Flow

```
1. HR admin clicks "Open Employee Portal" on an employee's profile
2. POST /api/admin/employee/impersonate → creates EmployeeImpersonationToken (expires in 5 min)
3. Browser opens /employee/dashboard?impersonate=<TOKEN>
4. middleware.ts intercepts, calls POST /api/admin/employee/impersonate/validate
5. Token is validated + marked as usedAt
6. signEmployeeToken({ employeeId, phone }) → creates employee JWT
7. Set-Cookie: employee_session=<JWT>
8. Redirect to /employee/dashboard (clean URL)
```

Tokens are single-use (`usedAt` field) and short-lived (`expiresAt` typically 5–15 minutes).
