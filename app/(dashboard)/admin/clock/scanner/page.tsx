import { requireRole } from "@/lib/auth";
import { QrScannerClient } from "@/components/timesheet/qr-scanner-client";

export default async function QrScannerPage() {
  await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
  return <QrScannerClient />;
}
