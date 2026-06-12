# Database & Data Models

> Part of the [Bazaar Printing HR Documentation](../DOCUMENTATION.md)

---

## Connection Setup

**ORM:** Prisma 6.9  
**Database:** PostgreSQL hosted on Supabase  
**Schema file:** `prisma/schema.prisma`  
**Singleton client:** `lib/prisma.ts`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled connection (PgBouncer)
  directUrl = env("DIRECT_URL")     // direct connection for migrations
}
```

The Prisma client is instantiated once and reused:

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client"
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

## Entity Relationship Overview

`Employee` is the central entity. Almost every domain model has a foreign key pointing back to it.

```
User (1) ──────────────────── (0..1) Employee
                                        │
                ┌───────────────────────┼────────────────────────┐
                │                       │                        │
           Department              Position                  Manager
           (many employees)     (many employees,        (self-ref on Employee)
                                 1 AccrualPolicy,
                                 1 OnboardingTemplate,
                                 1 OffboardingTemplate)
                │
    ┌───────────┼──────────────────────────────────────────────────┐
    │           │           │           │           │              │
TimeEntry   LeaveRequest LeaveBalance Notification WriteUp   DocumentAssignment
    │           │
BreakEntry  LeaveType ── LeaveBalance ── LeaveAccrualLog
                                          AccrualPolicy (via Position)

OnboardingTemplate ── OnboardingStep ── OnboardingInstance ── OnboardingStepProgress
OffboardingTemplate ── OffboardingStep ── OffboardingInstance ── OffboardingStepProgress

Sop (document repo) ── DocumentAssignment ── SopAcknowledgment
                     ── DocumentPositionLink (Position or Department)
                     ── DocumentShareLink
```

---

## All 37 Models

### 1. `User`
Application users linked to Supabase Auth by email.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `email` | String (unique) | Must match Supabase Auth email |
| `name` | String? | Display name |
| `role` | Role enum | Default: EMPLOYEE |
| `employeeId` | String? (unique) | Optional link to Employee record |
| `employee` | Employee? | Relation to Employee |
| `mustChangePassword` | Boolean | Forces password change on next login |
| `createdAt` / `updatedAt` | DateTime | Timestamps |

**Relations (outgoing):** `reviewedLeaveRequests`, `adjustedLeaveBalances`, `adjustedAccrualLogs`, `uploadedSops`, `assignedDocuments`, `auditLogs`, `createdImpersonationTokens`, `createdOnboardingTemplates`, `triggeredOnboardings`, `sentOnboardingReminders`, `createdOffboardingTemplates`, `triggeredOffboardings`

---

### 2. `Employee`
Core HR record. Contains all personal, employment, schedule, and compensation data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `firstName`, `lastName` | String | Required |
| `preferredName` | String? | Nickname |
| `personalEmail` | String? | Personal email |
| `workEmail` | String? (unique) | Work email — used for Supabase User |
| `phone` | String? (unique) | Used for OTP login |
| `departmentId` | String? | FK → Department |
| `positionId` | String? | FK → Position |
| `jobTitle` | String? | Free-text job title |
| `employmentType` | EmploymentType | FULL_TIME / PART_TIME / CONTRACT |
| `managerId` | String? | Self-referential FK (manager is also an Employee) |
| `payType` | PayType | HOURLY / SALARY |
| `payRate` | Float? | Hourly rate or annual salary |
| `payFrequency` | PayFrequency? | WEEKLY / BIWEEKLY / SEMI_MONTHLY / MONTHLY |
| `isNonExempt` | Boolean | Default: true |
| `overtimeEligible` | Boolean | Default: true |
| `startDate` | DateTime? | Hire date |
| `status` | EmployeeStatus | ACTIVE / INACTIVE |
| `employeeNumber` | String? (unique) | HR-assigned ID |
| `qrCodeToken` | String? (unique) | Token embedded in QR code for clock-in scanning |
| `scheduleType` | ScheduleType | FIXED / SHIFT_BASED / HOURS_BASED / FLEXIBLE |
| `scheduleConfig` | Json? | Schedule details (varies by type) |
| `mealBreak1WaiverEnabled` | Boolean | CA meal break 1 waiver |
| `mealBreak2WaiverEnabled` | Boolean | CA meal break 2 waiver |
| `portalPinHash` | String? | Hashed PIN for employee portal (legacy) |
| Various dates | DateTime? | `contractEndDate`, `probationEndDate`, `nextReviewDate`, `benefitsEnrollmentDeadline`, `compensationEffectiveDate` |
| Address fields | String? | `addressStreet`, `addressCity`, `addressState`, `addressZip`, `addressCountry` |
| Personal | Various | `birthdate`, `tShirtSize`, `allergies`, emergency contact fields |

**Relations (outgoing):** `user`, `timeEntries`, `leaveRequests`, `leaveBalances`, `sopAcknowledgments`, `documentAssignments`, `onboardingInstances`, `notifications`, `writeUps`, `managerNotes`, `generatedDocuments`, `impersonationTokens`, `documentShareLinks`, `compensationHistory`, `identityDocuments`, `offboardingInstances`, `leaveAccrualLogs`, `individualHolidays`, `directReports`

---

### 3. `EmployeeOTP`
Standalone table for SMS OTP codes used in employee portal phone login. Not linked to Employee — matched by phone number at verification time.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | |
| `phone` | String | Indexed |
| `code` | String | 6-digit OTP |
| `expiresAt` | DateTime | TTL for the code |
| `usedAt` | DateTime? | Set on successful verification |

---

### 4. `EmployeeIdentityDocument`
Stores identity documents (SSN, passport, etc.) per employee.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | |
| `employeeId` | String | FK → Employee (cascade delete) |
| `docType` | IdDocType | SSN / PASSPORT / WORK_PERMIT / DRIVERS_LICENSE / GOVERNMENT_ID |
| `documentNumber` | String? | Encrypted at application layer (SSN) |
| `country` | String? | |
| `expiryDate` | DateTime? | |
| `notes` | String? | |
| `fileUrl` | String? | Supabase Storage URL |
| `fileName` | String? | |
| `createdBy` | String | User ID who uploaded |

---

### 5. `CompensationHistory`
Audit trail of pay rate changes.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `previousRate` | Float? | |
| `newRate` | Float | |
| `payType` | PayType | |
| `effectiveDate` | DateTime | |
| `changedBy` | String | User ID |
| `note` | String? | |

---

### 6. `Department`
Organizational department.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | |
| `name` | String | |
| `description` | String? | |

**Relations:** `employees[]`, `positions[]`, `documentLinks[]`

---

### 7. `Position`
Job position within a department.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | |
| `name` | String | |
| `departmentId` | String | FK → Department |
| `isActive` | Boolean | |

**Relations:** `employees[]`, `onboardingTemplates[]`, `offboardingTemplate?`, `documentLinks[]`, `accrualPolicy?`

---

### 8. `AccrualPolicy`
Per-position PTO/sick accrual rules (one-to-one with Position).

| Field | Type | Notes |
|-------|------|-------|
| `positionId` | String (unique) | FK → Position (cascade) |
| `hoursWorkedPerAccrual` | Float | Default: 30 (hours worked to earn 1 hour PTO) |
| `hoursEarnedPerAccrual` | Float | Default: 1 |
| `ptoAccrualCapHours` | Float | Default: 120 |
| `ptoRolloverCapHours` | Float | Default: 40 |
| `sickAccrualCapHours` | Float | Default: 80 |
| `usableAfterDays` | Int | Default: 90 (waiting period) |

---

### 9. `TimeEntry`
Clock in/out record for an employee shift.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `clockIn` | DateTime | |
| `clockOut` | DateTime? | Null if still in progress |
| `hoursWorked` | Float? | Calculated on clock-out |
| `status` | TimeEntryStatus | IN_PROGRESS / ON_BREAK / COMPLETED / APPROVED / FLAGGED |
| `clockInMethod` | ClockMethod | PORTAL / QR_SCAN / MANUAL / KIOSK |
| `clockOutMethod` | ClockMethod? | |
| `date` | DateTime | DB default: now() |
| `notes` | String? | |
| `approvedById` | String? | |
| `approvedAt` | DateTime? | |

**Index:** `(employeeId, clockIn)`, `(status)`

**Relations:** `breaks[]` → BreakEntry

---

### 10. `BreakEntry`
A single rest or meal break within a TimeEntry.

| Field | Type | Notes |
|-------|------|-------|
| `timeEntryId` | String | FK → TimeEntry (cascade) |
| `breakType` | BreakType | REST / MEAL |
| `startedAt` | DateTime | |
| `endedAt` | DateTime? | Null if break still active |
| `durationMin` | Float? | Calculated on break end |

---

### 11. `LocationZone`
A named geofence zone for clock-in validation.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | |
| `lat` / `lng` | Float | Center coordinates |
| `radiusMeters` | Int | |
| `isActive` | Boolean | |

> Note: The application's primary geofencing uses environment variables (`FACILITY_LAT`, `FACILITY_LNG`, `GEOFENCE_RADIUS_M`). `LocationZone` records can define additional named zones.

---

### 12. `LeaveType`
Defines a category of leave (PTO, sick, personal, unpaid, etc.).

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | |
| `slug` | String? (unique) | Machine-readable identifier |
| `defaultDays` | Float | Default annual allowance |
| `accrualType` | AccrualType | LUMP_SUM (granted at year start) / ACCRUED (earned over time) |
| `isPaid` | Boolean | |
| `isActive` | Boolean | |
| `carryOver` | Boolean | |

**Relations:** `leaveRequests[]`, `leaveBalances[]`, `accrualLogs[]`

---

### 13. `LeaveRequest`
A leave request submitted by an employee.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee |
| `leaveTypeId` | String | FK → LeaveType |
| `startDate` / `endDate` | DateTime | |
| `workingDays` | Float | Calculated (excludes weekends/holidays) |
| `status` | LeaveRequestStatus | PENDING / APPROVED / REJECTED / CANCELLED |
| `notes` | String? | Employee comment |
| `reviewedById` | String? | FK → User (reviewer) |
| `reviewComment` | String? | |
| `submittedAt` | DateTime | |
| `reviewedAt` | DateTime? | |

**Index:** `(employeeId, status)`

---

### 14. `LeaveBalance`
Per-employee, per-leave-type, per-year balance tracking.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee |
| `leaveTypeId` | String | FK → LeaveType |
| `year` | Int | Calendar year |
| `allowance` | Float | Total days granted |
| `usedDays` | Float | Approved days used |
| `pendingDays` | Float | Pending approval |
| `balanceHours` | Float | For accrued types (hours) |
| `accrualHoursEarned` | Float | Running total earned |
| `accrualHoursWorked` | Float | Running total hours worked for accrual |
| `lastAccrualAt` | DateTime? | Last time accrual ran |
| `yearStartBalance` | Float | Balance at year start (for rollover tracking) |
| `adjustedById` | String? | FK → User (manual adjuster) |
| `adjustmentReason` | String? | |

**Unique constraint:** `(employeeId, leaveTypeId, year)`

---

### 15. `LeaveAccrualLog`
Event log for each accrual calculation or manual adjustment.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee |
| `leaveTypeId` | String | FK → LeaveType |
| `type` | AccrualEventType | ACCRUAL / MANUAL_ADJUSTMENT / YEAR_END_ROLLOVER / BALANCE_RESET |
| `hoursWorked` | Float? | Hours that triggered this event |
| `hoursEarned` | Float | Hours credited |
| `balanceAfter` | Float | Balance after this event |
| `note` | String? | |
| `adjustedById` | String? | FK → User (if manual) |

---

### 16. `Holiday`
Company-wide or individual employee holiday.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | |
| `date` | DateTime | |
| `isCompanyWide` | Boolean | Default: true |
| `employeeId` | String? | FK → Employee (if individual) |
| `isPaid` | Boolean | |
| `isRecurringAnnually` | Boolean | |

**Unique constraint:** `(name, date)`

---

### 17. `Sop`
Document repository entry (SOP, policy, NDA, tax form, training material, etc.).

| Field | Type | Notes |
|-------|------|-------|
| `title` | String | |
| `description` | String | |
| `documentType` | DocumentType | SOP / POLICY / NDA / TAX_FORM / SAFETY_DOCUMENT / TRAINING_MATERIAL / EMPLOYEE_AGREEMENT / ONBOARDING_DOCUMENT / OTHER |
| `scope` | DocumentRepositoryScope | COMPANY_WIDE / POSITION_SPECIFIC |
| `version` | Int | Default: 1 |
| `departmentIds` | String[] | Scoped departments |
| `positionIds` | String[] | Scoped positions |
| `fileUrl` | String | Supabase Storage URL |
| `effectiveDate` | DateTime | |
| `changeSummary` | String? | |
| `uploadedById` | String | FK → User |
| `status` | SopStatus | ACTIVE / ARCHIVED |
| `isActive` | Boolean | |

**Relations:** `acknowledgments[]`, `assignments[]`, `positionLinks[]`

---

### 18. `DocumentPositionLink`
Maps a document (`Sop`) to specific positions or departments for scoped auto-assignment.

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | String | FK → Sop (cascade) |
| `positionId` | String? | FK → Position |
| `departmentId` | String? | FK → Department |

---

### 19. `DocumentAssignment`
Assigns a `Sop` document to a specific employee (onboarding or offboarding context).

| Field | Type | Notes |
|-------|------|-------|
| `sopId` | String | FK → Sop (cascade) |
| `employeeId` | String | FK → Employee (cascade) |
| `assignedById` | String | FK → User |
| `assignedManually` | Boolean | True if HR manually assigned (not auto-scoped) |
| `isOffboarding` | Boolean | Distinguishes onboarding vs offboarding assignments |
| `sentAt` | DateTime? | When the document was sent to the employee |
| `offboardingSentAt` | DateTime? | |
| `acknowledgedAt` | DateTime? | When employee acknowledged |
| `signedFileUrl` | String? | Employee's signed upload |
| `signedAt` | DateTime? | |
| `hrApprovedAt` | DateTime? | When HR approved the signed document |
| `hrApprovedBy` | String? | User ID of HR approver |

**Unique:** `(sopId, employeeId, isOffboarding)`

---

### 20. `SopAcknowledgment`
Records that an employee acknowledged a specific version of a document.

| Field | Type | Notes |
|-------|------|-------|
| `sopId` | String | FK → Sop |
| `sopVersion` | Int | Version at time of acknowledgment |
| `employeeId` | String | FK → Employee (cascade) |
| `acknowledgedAt` | DateTime | |
| `reminderCount` | Int | How many reminders were sent |

**Unique:** `(sopId, employeeId, sopVersion)` — one acknowledgment per version per employee

---

### 21. `DocumentShareLink`
Token-based external share link for sending documents outside the portal.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `token` | String (unique) | Random secure token |
| `channel` | String | Delivery channel (email/SMS) |
| `recipient` | String | Email or phone |
| `expiresAt` | DateTime | Link expiry |
| `viewedAt` | DateTime? | First view time |
| `completedAt` | DateTime? | When all docs signed/uploaded |
| `selectedDocumentIds` | String[] | IDs of documents included in this link |

---

### 22. `OnboardingTemplate`
A reusable onboarding flow definition for a Position.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | |
| `positionId` | String | FK → Position |
| `estimatedCompletionTime` | String? | Free-text estimate |
| `isActive` | Boolean | |
| `createdById` | String | FK → User |

**Relations:** `steps[]`, `instances[]`

---

### 23. `OnboardingStep`
An individual step within an OnboardingTemplate.

| Field | Type | Notes |
|-------|------|-------|
| `templateId` | String | FK → OnboardingTemplate (cascade) |
| `title` | String | |
| `description` | String? | |
| `stepType` | OnboardingStepType | FORM / DOCUMENT_SIGN / SURVEY / FILE_UPLOAD |
| `sortOrder` | Int | Display order |
| `isRequired` | Boolean | |
| `config` | Json | Step-specific configuration |

**Index:** `(templateId, sortOrder)`

---

### 24. `OnboardingInstance`
A running onboarding process for a specific employee.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `templateId` | String | FK → OnboardingTemplate |
| `triggeredById` | String | FK → User (who initiated) |
| `status` | OnboardingInstanceStatus | NOT_STARTED / IN_PROGRESS / COMPLETED |
| `startedAt` | DateTime? | |
| `completedAt` | DateTime? | |

**Relations:** `stepProgress[]`, `reminders[]`

---

### 25. `OnboardingStepProgress`
Tracks the status of each step for a specific OnboardingInstance.

| Field | Type | Notes |
|-------|------|-------|
| `instanceId` | String | FK → OnboardingInstance (cascade) |
| `stepId` | String | FK → OnboardingStep |
| `status` | OnboardingStepProgressStatus | LOCKED / AVAILABLE / IN_PROGRESS / COMPLETED |
| `completedAt` | DateTime? | |
| `responseData` | Json? | Form/survey responses |
| `uploadedFileUrl` | String? | File upload URL |

**Unique:** `(instanceId, stepId)`

---

### 26. `OnboardingReminder`
Audit record each time an HR user sends an onboarding reminder.

| Field | Type | Notes |
|-------|------|-------|
| `instanceId` | String | FK → OnboardingInstance (cascade) |
| `sentById` | String | FK → User |
| `sentAt` | DateTime | |

---

### 27. `OffboardingTemplate`
Reusable offboarding flow for a Position (one-to-one with Position).

| Field | Type | Notes |
|-------|------|-------|
| `positionId` | String (unique) | FK → Position |
| `name` | String | |
| `isActive` | Boolean | |
| `createdById` | String | FK → User |

**Relations:** `steps[]`, `instances[]`

---

### 28. `OffboardingStep`
A step within an OffboardingTemplate. Uses the same `OnboardingStepType` enum.

Same fields as `OnboardingStep` but in an offboarding context.

---

### 29. `OffboardingInstance`
A running offboarding process for a specific employee.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `templateId` | String? | FK → OffboardingTemplate (optional — can be custom) |
| `triggeredById` | String | FK → User |
| `status` | OffboardingInstanceStatus | IN_PROGRESS / COMPLETED / CANCELLED |
| `lastDayDate` | DateTime? | Employee's last working day |
| `initiatedAt` | DateTime | |
| `completedAt` | DateTime? | |

---

### 30. `OffboardingStepProgress`
Mirrors `OnboardingStepProgress` for offboarding steps.

---

### 31. `Notification`
In-app notification for an employee.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `eventType` | String | Free-text event identifier (e.g. `"leave_approved"`) |
| `channel` | NotificationChannel | EMAIL / SMS / IN_APP |
| `sentAt` | DateTime? | |
| `status` | NotificationStatus | SENT / FAILED / READ |
| `contentSnapshot` | Json? | Snapshot of notification content |

---

### 32. `AuditLog`
General-purpose audit trail for sensitive actions.

| Field | Type | Notes |
|-------|------|-------|
| `userId` | String | FK → User (who performed the action) |
| `action` | String | Description of the action |
| `targetId` | String? | ID of the affected record |
| `targetTable` | String? | Table name of affected record |
| `oldValue` | Json? | Previous state |
| `newValue` | Json? | New state |
| `reason` | String? | Optional justification |
| `ipAddress` | String? | Client IP |

**Index:** `(userId, createdAt)`, `(targetTable, targetId)`

---

### 33. `WriteUp`
A disciplinary write-up issued to an employee.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `number` | Int | Sequential per-employee number |
| `category` | WriteUpCategory | ATTENDANCE / CONDUCT / PERFORMANCE / SAFETY / POLICY / OTHER |
| `date` | DateTime | Date of incident |
| `description` | String | |
| `consequence` | String? | |
| `issuedBy` | String | User ID |
| `employeeSignedAt` | DateTime? | |
| `acknowledgedAt` | DateTime? | |
| `acknowledgedBy` | String? | |
| `attachmentUrl` | String? | |

**Unique:** `(employeeId, number)`

---

### 34. `ManagerNote`
Internal note about an employee, visible only to HR/manager.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `content` | String | |
| `issuedBy` | String | User ID |

---

### 35. `GeneratedDocument`
A system-generated PDF (offer letter, welcome email) stored in Supabase Storage.

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | String | FK → Employee (cascade) |
| `type` | GeneratedDocumentType | OFFER_LETTER / WELCOME_EMAIL |
| `fileUrl` | String | Supabase Storage URL |
| `generatedBy` | String | User ID |
| `generatedAt` | DateTime | |

---

### 36. `EmployeeImpersonationToken`
Single-use token allowing HR admin to open the employee portal as a specific employee.

| Field | Type | Notes |
|-------|------|-------|
| `token` | String (unique) | Random secure token |
| `employeeId` | String | FK → Employee (cascade) |
| `createdBy` | String | FK → User (HR admin) |
| `expiresAt` | DateTime | Short-lived expiry |
| `usedAt` | DateTime? | Set when consumed |

---

### 37. `CompanySettings`
Singleton configuration record (`id = "default"`).

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | Always `"default"` |
| `overtimeThresholdHours` | Float | Default: 40 (weekly hours before OT) |
| `coverageWarningPercent` | Float | Default: 30 |
| `lateThresholdMinutes` | Int | Default: 15 |
| `yearEndRolloverPolicy` | YearEndRolloverPolicy | CARRY_OVER / EXPIRE / CASH_OUT |
| `updatedById` | String? | FK → User |

---

## All Enums

| Enum | Values |
|------|--------|
| `Role` | SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE |
| `EmploymentType` | FULL_TIME, PART_TIME, CONTRACT |
| `PayType` | HOURLY, SALARY |
| `PayFrequency` | WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY |
| `EmployeeStatus` | ACTIVE, INACTIVE |
| `ScheduleType` | FIXED, SHIFT_BASED, HOURS_BASED, FLEXIBLE |
| `IdDocType` | SSN, PASSPORT, WORK_PERMIT, DRIVERS_LICENSE, GOVERNMENT_ID |
| `TShirtSize` | XS, S, M, L, XL, XXL, XXXL |
| `TimeEntryStatus` | IN_PROGRESS, ON_BREAK, COMPLETED, APPROVED, FLAGGED |
| `ClockMethod` | PORTAL, QR_SCAN, MANUAL, KIOSK |
| `BreakType` | REST, MEAL |
| `AccrualEventType` | ACCRUAL, MANUAL_ADJUSTMENT, YEAR_END_ROLLOVER, BALANCE_RESET |
| `AccrualType` | LUMP_SUM, ACCRUED |
| `LeaveRequestStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `YearEndRolloverPolicy` | CARRY_OVER, EXPIRE, CASH_OUT |
| `SopStatus` | ACTIVE, ARCHIVED |
| `DocumentRepositoryScope` | COMPANY_WIDE, POSITION_SPECIFIC |
| `DocumentType` | SOP, POLICY, NDA, TAX_FORM, SAFETY_DOCUMENT, TRAINING_MATERIAL, EMPLOYEE_AGREEMENT, ONBOARDING_DOCUMENT, OTHER |
| `OnboardingStepType` | FORM, DOCUMENT_SIGN, SURVEY, FILE_UPLOAD |
| `OnboardingInstanceStatus` | NOT_STARTED, IN_PROGRESS, COMPLETED |
| `OnboardingStepProgressStatus` | LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED |
| `OffboardingInstanceStatus` | IN_PROGRESS, COMPLETED, CANCELLED |
| `NotificationChannel` | EMAIL, SMS, IN_APP |
| `NotificationStatus` | SENT, FAILED, READ |
| `WriteUpCategory` | ATTENDANCE, CONDUCT, PERFORMANCE, SAFETY, POLICY, OTHER |
| `GeneratedDocumentType` | OFFER_LETTER, WELCOME_EMAIL |

---

## RLS (Row-Level Security) Model

All tables have RLS enabled at the PostgreSQL layer via Supabase.

**Key principle:** The Supabase `anon` key (used by browser clients) is denied direct table access. **All application data flows through Prisma** using the `postgres` superuser role, which bypasses RLS. Supabase `service_role` is used only for Auth admin and Storage operations.

### Migration History

| Migration | File | Purpose |
|-----------|------|---------|
| `20250608000000` | `prisma/migrations/20250608000000_enable_row_level_security/` | Enable RLS on all core tables; deny `anon` direct access |
| `20250609000000` | `prisma/migrations/20250609000000_enable_rls_additional_tables/` | RLS on DocumentAssignment, WriteUp, ManagerNote, etc. |
| `20250610000000` | `prisma/migrations/20250610000000_document_assignment_sent_at/` | Add `assignedManually`, `sentAt`, `offboardingSentAt` columns to DocumentAssignment |

### Verification

Run `npm run db:verify-rls` to confirm all RLS policies are active. The script is at `prisma/verify-rls.ts` and uses `prisma/sql/verify-rls.sql`.

---

## Database Seed Scripts

| Script | NPM Command | Purpose |
|--------|------------|---------|
| `prisma/seed.ts` | `npm run db:seed` | Departments, leave types (PTO/sick/personal), accrual policies, US federal holidays, leave balances |
| `prisma/seed-documents.ts` | `npm run db:seed-documents` | Initial document repository entries |
| `prisma/create-admin.ts` | `npm run db:create-admin` | Creates a SUPER_ADMIN user in both Supabase Auth and Prisma |
