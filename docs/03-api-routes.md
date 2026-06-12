# API Routes Reference

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Standard Response Envelope

Every API route returns a consistent JSON shape defined in `lib/api-response.ts`:

```typescript
type ApiResponse<T> = {
  data: T | null;      // Payload on success, null on error
  error: string | null; // Error message on failure, null on success
  message: string | null; // Optional human-readable message
}
```

**Helper functions:**
- `apiSuccess(data, message?)` — builds a success response object
- `apiError(error, message?, status?)` — returns a `Response` with error JSON (default status: 400)
- `getPaginationParams(searchParams)` — parses `page` and `limit` query params, returns `{ page, limit, skip }`

**HTTP status codes used:**
- `200` — success
- `201` — created
- `400` — bad request / validation error
- `401` — unauthenticated
- `403` — unauthorized (wrong role)
- `404` — not found
- `500` — server error

---

## Authentication Requirements

| Auth Type | How it works | Routes |
|-----------|-------------|--------|
| **Supabase session** | Cookie set by Supabase Auth; verified via `getSession()` in `lib/auth.ts` | All `/api/admin/*`, `/api/employees/*`, `/api/leave/*`, `/api/documents/*`, `/api/settings/*`, `/api/departments/*`, `/api/positions/*`, `/api/holidays/*`, `/api/notifications/*`, `/api/clock/*`, `/api/auth/*` |
| **Employee JWT** | `employee_session` HttpOnly cookie; verified via `getEmployeeSession()` in `lib/employee-session.ts` | All `/api/employee/*` |
| **Cron secret** | Bearer token in `Authorization` header matching `CRON_SECRET` env var | `/api/cron/*` |
| **None** | Unauthenticated | `/api/kiosk/clock`, `/api/health`, `/api/docs/[token]`, `/api/employee/auth/*` |

---

## 1. Authentication (HR)

Base path: `/api/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/me` | Supabase session | Returns the current `AuthUser` (id, email, name, role, employeeId, mustChangePassword) |
| POST | `/api/auth/change-password` | Supabase session | Changes the authenticated user's password; clears `mustChangePassword` flag |

---

## 2. Employee Portal Authentication

Base path: `/api/employee/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/employee/auth/employees` | None | Returns list of active employees (id, firstName, lastName, phone) for the login picker UI |
| POST | `/api/employee/auth/send-otp` | None | Generates and sends a 6-digit SMS OTP via Twilio to the given phone number |
| POST | `/api/employee/auth/verify-otp` | None | Verifies OTP code; on success creates an `employee_session` JWT cookie |
| POST | `/api/employee/auth/validate-session` | None | Checks that the `employeeId` in an existing session still maps to an active Employee record |
| POST | `/api/employee/auth/logout` | None | Clears the `employee_session` cookie |

---

## 3. Employee Self-Service

Base path: `/api/employee`

All routes require a valid `employee_session` JWT cookie.

### Profile

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/me` | Returns the authenticated employee's profile |
| PATCH | `/api/employee/me` | Updates editable profile fields |
| POST | `/api/employee/me/change-password` | Changes portal PIN/password |
| GET | `/api/employee/me/preferences` | Returns employee preferences |
| PATCH | `/api/employee/me/preferences` | Updates employee preferences |

### Time & Attendance

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/time-entries` | Returns the employee's time entry history |
| GET | `/api/employee/qr` | Returns the employee's QR code token data |
| GET | `/api/employee/break-schedule` | Returns the employee's CA break schedule |

### Leave

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/leave` | Returns the employee's leave balances and types |
| POST | `/api/employee/leave` | Submits a new leave request |
| POST | `/api/employee/leave/request` | Alias — submit a leave request |
| GET | `/api/employee/leave-requests` | Lists the employee's leave requests |

### Documents

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/documents` | Lists documents assigned to the employee |
| GET | `/api/employee/documents/unacknowledged-count` | Returns count for notification badge |
| POST | `/api/employee/documents/[id]/upload` | Uploads a signed version of a document |

### Onboarding

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/onboarding-tasks` | Returns the employee's onboarding tasks |
| PATCH | `/api/employee/onboarding-tasks/[progressId]` | Marks a step complete or updates progress |
| POST | `/api/employee/onboarding-tasks/[progressId]/upload` | Uploads a file for a step |

### Offboarding

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/offboarding-documents` | Returns offboarding document assignments |

### Notifications

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/notifications` | Lists the employee's in-app notifications |
| POST | `/api/employee/notifications/read-all` | Marks all notifications as READ |

### Miscellaneous

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employee/write-ups` | Lists write-ups for the employee |
| POST | `/api/employee/write-ups/[id]/acknowledge` | Employee acknowledges a write-up |
| GET | `/api/employee/important-dates` | Returns important dates (birthdays, anniversaries, etc.) |
| GET | `/api/employee/hr-documents` | Returns HR-generated documents (offer letter, etc.) |

---

## 4. Clock & Time (Portal)

Base path: `/api/clock`

Requires Supabase session (for employee dashboard users). Employee portal clock-in goes through `/api/clock` as well, authenticated via employee session.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/clock/in` | Employee session | Clock in; accepts optional GPS coords; validates geofencing |
| POST | `/api/clock/out` | Employee session | Clock out; calculates `hoursWorked`; saves TimeEntry |
| GET | `/api/clock/status` | Employee session | Returns current clock status (in/out, active break, open entry) |
| POST | `/api/clock/break/start` | Employee session | Starts a break; sets TimeEntry status to ON_BREAK |
| POST | `/api/clock/break/end` | Employee session | Ends a break; calculates `durationMin` |

### Kiosk (Unauthenticated)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/kiosk/clock` | None | Clock in/out via QR code scan from a kiosk device; identifies employee by `qrCodeToken` |

---

## 5. Admin Clock & Timesheet

Base path: `/api/admin`

Requires HR_ADMIN, SUPER_ADMIN, or MANAGER role.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/clock/live` | Returns all currently clocked-in employees with status and break info |
| POST | `/api/admin/clock/scan` | Clock in/out an employee via QR code scan (admin-initiated) |
| GET | `/api/admin/time-entries` | Lists time entries with filters (employee, date range, status) |
| POST | `/api/admin/time-entries` | Creates a manual time entry for an employee |
| PATCH | `/api/admin/time-entries/[id]` | Edits a time entry (adjust clockIn/clockOut, add notes) |
| DELETE | `/api/admin/time-entries/[id]` | Deletes a time entry |
| POST | `/api/admin/time-entries/merge` | Merges two overlapping time entries into one |
| GET | `/api/admin/time-entries/export` | Exports timesheet data as CSV |

---

## 6. Employees (HR)

Base path: `/api/employees`

Requires HR_ADMIN, SUPER_ADMIN, or MANAGER (managers get read-only subset).

### Core CRUD

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees` | Lists all employees; supports search, filter by department/status, pagination |
| POST | `/api/employees` | Creates a new employee (provisions Supabase Auth user, leave balances, document assignments) |
| GET | `/api/employees/count` | Returns total active employee count |
| GET | `/api/employees/managers` | Returns list of employees eligible to be managers |
| GET | `/api/employees/[id]` | Returns full employee detail |
| PATCH | `/api/employees/[id]` | Updates employee information |
| POST | `/api/employees/[id]/deactivate` | Deactivates an employee (sets status to INACTIVE) |

### Activity & Notes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/activity` | Returns activity log for the employee |
| GET | `/api/employees/[id]/notes` | Lists manager notes |
| POST | `/api/employees/[id]/notes` | Creates a manager note |

### Write-ups

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/writeups` | Lists write-ups |
| POST | `/api/employees/[id]/writeups` | Creates a new write-up |

### Identity Documents

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/identity-documents` | Lists identity documents (SSN masked) |
| POST | `/api/employees/[id]/identity-documents` | Adds an identity document |

### Compensation

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/compensation-history` | Returns pay rate change history |
| POST | `/api/employees/[id]/compensation-history` | Records a pay rate change |

### Schedule & Breaks

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/break-schedule` | Returns the employee's break schedule config |
| PATCH | `/api/employees/[id]/break-schedule` | Updates break schedule / waiver settings |

### Important Dates

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/important-dates` | Returns upcoming dates (probation end, review, benefits deadline, etc.) |

### Onboarding Progress

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/onboarding-progress` | Returns active onboarding instance status |

### Portal Notifications

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/employees/[id]/portal-notification` | Sends an in-app notification to the employee's portal |

### Documents (per-employee)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/documents` | Lists documents assigned to this employee |
| POST | `/api/employees/[id]/documents/assign` | Assigns a document to this employee |
| POST | `/api/employees/[id]/documents/send` | Sends assigned documents to the employee (email/SMS) |
| POST | `/api/employees/[id]/documents/[docId]/approve` | HR approves a signed document upload |
| POST | `/api/employees/[id]/documents/share-links` | Creates a document share link for external access |
| GET | `/api/employees/[id]/documents/share-links` | Lists share links for this employee |
| POST | `/api/employees/[id]/documents/generate` | Generates a PDF document (offer letter, etc.) |

### Leave (per-employee HR view)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/leave-balances` | Returns leave balances for this employee |
| POST | `/api/employees/[id]/leave-adjustments` | Makes a manual adjustment to a leave balance |
| GET | `/api/employees/[id]/leave-accrual` | Returns accrual log |

### Offboarding (per-employee)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/employees/[id]/offboarding-instance` | Returns active offboarding instance |
| POST | `/api/employees/[id]/offboarding-instance` | Starts an offboarding process |
| GET | `/api/employees/[id]/offboarding-documents` | Lists offboarding document assignments |

---

## 7. Leave Management

Base path: `/api/leave`

### Requests

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/leave/requests` | HR/Manager | Lists all leave requests; supports filters (status, employee, date range) |
| POST | `/api/leave/requests` | HR/Manager | Creates a leave request on behalf of an employee |
| GET | `/api/leave/requests/[id]` | HR/Manager | Returns a single leave request detail |
| PATCH | `/api/leave/requests/[id]` | HR/Manager | Updates a leave request |
| POST | `/api/leave/requests/[id]/approve` | HR/Manager | Approves a pending request; updates `LeaveBalance.usedDays` |
| POST | `/api/leave/requests/[id]/reject` | HR/Manager | Rejects a pending request |
| POST | `/api/leave/requests/[id]/undo` | HR/Manager | Reverts an approved/rejected request back to PENDING |

### Balances

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/leave/balances` | HR/Manager | Returns leave balances for all employees |
| GET | `/api/leave/balances/[employeeId]` | HR/Manager | Returns balances for a specific employee |

### Stats

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/leave/stats` | HR/Manager | Returns counts for badge display (pending requests) |

---

## 8. Document Repository

Base path: `/api/documents`

Requires HR_ADMIN or SUPER_ADMIN.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/documents` | Lists all documents in the repository |
| POST | `/api/documents` | Creates a new document record |
| GET | `/api/documents/[id]` | Returns a single document |
| PATCH | `/api/documents/[id]` | Updates document metadata |
| DELETE | `/api/documents/[id]` | Archives/deletes a document |
| POST | `/api/documents/upload` | Uploads a PDF to Supabase Storage; returns `fileUrl` |
| POST | `/api/documents/[id]/assign` | Assigns document to employees (by position/department/individual) |
| POST | `/api/documents/[id]/notify` | Sends notification to employees who haven't acknowledged |
| GET | `/api/documents/available` | Returns documents available for onboarding assignment |
| GET | `/api/documents/available-offboarding` | Returns documents available for offboarding |

---

## 9. Onboarding

Base path: `/api/onboarding`

Requires HR_ADMIN or SUPER_ADMIN.

### Templates

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/onboarding/templates` | Lists all onboarding templates |
| POST | `/api/onboarding/templates` | Creates a template |

### Instances

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/onboarding/instances` | Lists all onboarding instances (with status) |
| POST | `/api/onboarding/instances` | Starts a new onboarding for an employee |
| GET | `/api/onboarding/instances/active` | Returns the active onboarding instance (for nav badge) |
| GET | `/api/onboarding/instances/[id]` | Returns instance detail with step progress |
| PATCH | `/api/onboarding/instances/[id]` | Updates instance (e.g. mark complete) |
| PATCH | `/api/onboarding/instances/[id]/steps/[stepId]` | Updates a step's progress (HR-side) |
| POST | `/api/onboarding/instances/[id]/steps/[stepId]/document-sign` | Records document sign completion |
| POST | `/api/onboarding/instances/[id]/steps/[stepId]/upload` | Processes a file upload for a step |

### Position Flow (Settings-integrated)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/onboarding/position-flow` | Returns the onboarding flow for a given position |
| POST | `/api/onboarding/upload-document` | Uploads a document for use in an onboarding flow step |

### Settings: Position Flow Builder

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/settings/positions/[positionId]/onboarding-flow` | Returns the onboarding template for a position |
| POST | `/api/settings/positions/[positionId]/onboarding-flow` | Creates/replaces onboarding template |
| PATCH | `/api/settings/positions/[positionId]/onboarding-flow` | Updates template metadata |
| POST | `/api/settings/positions/[positionId]/onboarding-flow/steps` | Adds a step |
| PATCH | `/api/settings/positions/[positionId]/onboarding-flow/steps/[stepId]` | Updates a step |
| DELETE | `/api/settings/positions/[positionId]/onboarding-flow/steps/[stepId]` | Removes a step |

---

## 10. Offboarding

Base path: `/api/offboarding`

Requires HR_ADMIN or SUPER_ADMIN.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/offboarding/templates` | Lists all offboarding templates |
| POST | `/api/offboarding/templates` | Creates a template |

### Settings: Offboarding Flow Builder

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/settings/positions/[positionId]/offboarding-flow` | Returns the offboarding template for a position |
| POST | `/api/settings/positions/[positionId]/offboarding-flow` | Creates/replaces offboarding template |
| PATCH | `/api/settings/positions/[positionId]/offboarding-flow` | Updates template metadata |
| POST | `/api/settings/positions/[positionId]/offboarding-flow/steps` | Adds a step |
| PATCH | `/api/settings/positions/[positionId]/offboarding-flow/steps/[stepId]` | Updates a step |
| DELETE | `/api/settings/positions/[positionId]/offboarding-flow/steps/[stepId]` | Removes a step |

---

## 11. Settings

### Company Settings

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/settings/company` | HR/Super | Returns `CompanySettings` record |
| PATCH | `/api/settings/company` | HR/Super | Updates company settings |

### Departments

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/departments` | HR/Manager | Lists all departments |
| POST | `/api/departments` | HR/Super | Creates a department |
| GET | `/api/departments/[id]` | HR/Manager | Returns a department |
| PATCH | `/api/departments/[id]` | HR/Super | Updates a department |
| DELETE | `/api/departments/[id]` | HR/Super | Deletes a department |

### Positions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/positions` | HR/Manager | Lists all positions |
| POST | `/api/positions` | HR/Super | Creates a position |
| GET | `/api/settings/positions` | HR/Super | Lists positions (settings view) |
| GET | `/api/settings/positions/[positionId]` | HR/Super | Returns position detail |
| PATCH | `/api/settings/positions/[positionId]` | HR/Super | Updates a position |
| DELETE | `/api/settings/positions/[positionId]` | HR/Super | Deletes a position |
| GET | `/api/settings/positions/[positionId]/accrual-policy` | HR/Super | Returns the accrual policy for a position |
| PATCH | `/api/settings/positions/[positionId]/accrual-policy` | HR/Super | Updates the accrual policy |

### Leave Types

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/settings/leave-types` | HR/Super | Lists all leave types |
| POST | `/api/settings/leave-types` | HR/Super | Creates a leave type |
| PATCH | `/api/settings/leave-types/[id]` | HR/Super | Updates a leave type |
| DELETE | `/api/settings/leave-types/[id]` | HR/Super | Deactivates a leave type |

### Holidays

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/settings/holidays` | HR/Super | Lists all holidays |
| POST | `/api/settings/holidays` | HR/Super | Creates a holiday |
| PATCH | `/api/settings/holidays/[id]` | HR/Super | Updates a holiday |
| DELETE | `/api/settings/holidays/[id]` | HR/Super | Deletes a holiday |
| POST | `/api/holidays/seed-federal` | HR/Super | Seeds all US federal holidays for the current year |

### Location Zones

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/settings/location-zones` | HR/Super | Lists all geofence zones |
| POST | `/api/settings/location-zones` | HR/Super | Creates a zone |
| PATCH | `/api/settings/location-zones/[id]` | HR/Super | Updates a zone |
| DELETE | `/api/settings/location-zones/[id]` | HR/Super | Deletes a zone |

---

## 12. Admin Tools

Base path: `/api/admin`

Requires HR_ADMIN or SUPER_ADMIN.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/dashboard/kpis` | Returns dashboard KPI data (headcount, active onboardings, pending leave, etc.) |
| POST | `/api/admin/run-accrual` | Manually triggers accrual calculation for all employees |
| POST | `/api/admin/backfill-accrual` | Backfills accrual from historical time entries |
| POST | `/api/admin/employee/impersonate` | Creates a single-use impersonation token for an employee |
| POST | `/api/admin/employee/impersonate/validate` | Validates and consumes an impersonation token (used by middleware) |
| GET | `/api/admin/notifications` | Lists all notifications (admin view) |
| POST | `/api/admin/notifications` | Creates an admin notification |

---

## 13. Notifications

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/notifications` | Supabase session | Returns notifications for the current HR user's linked employee |
| POST | `/api/notifications` | Supabase session | Creates a notification |
| POST | `/api/notifications/mark-read` | Supabase session | Marks one or all notifications as READ |

---

## 14. Dashboard

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/dashboard/important-dates` | Supabase session | Returns upcoming important dates for the dashboard widget |

---

## 15. Public Share Links

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/docs/[token]` | None (token-based) | Validates the share link token and returns document metadata |
| POST | `/api/docs/[token]/upload` | None (token-based) | Accepts a signed document upload via the public share link |

---

## 16. Cron Jobs

Base path: `/api/cron`

Protected by `Authorization: Bearer <CRON_SECRET>` header.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cron/missed-clockouts` | Scans for time entries still `IN_PROGRESS` past end-of-day; sets them to `FLAGGED` |
| GET | `/api/cron/year-end-rollover` | Processes year-end leave balance rollover per `CompanySettings.yearEndRolloverPolicy` |

**Deployment note:** These routes are triggered by Vercel Cron Jobs. Configure in `vercel.json` or via Vercel dashboard with `Authorization` header.

---

## 17. Health Check

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | None | Returns `{ status: "ok" }` for uptime monitoring |
