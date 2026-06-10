-- Verify RLS is enabled on all application tables
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'AuditLog', 'CompanySettings', 'Department', 'DocumentAssignment',
    'DocumentPositionLink', 'DocumentShareLink', 'Employee', 'GeneratedDocument',
    'Holiday', 'LeaveBalance', 'LeaveRequest', 'LeaveType', 'LocationZone',
    'ManagerNote', 'Notification', 'OnboardingInstance', 'OnboardingReminder',
    'OnboardingStep', 'OnboardingStepProgress', 'OnboardingTemplate', 'Position',
    'Sop', 'SopAcknowledgment', 'TimeEntry', 'User', 'WriteUp'
  )
ORDER BY c.relname;
