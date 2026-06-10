import { AppShell } from "@/components/shared/app-shell";
import { Toaster } from "sonner";

/** Shared dashboard layout with sidebar navigation */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
