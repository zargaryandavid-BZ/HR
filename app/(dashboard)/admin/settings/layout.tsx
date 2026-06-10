import { SettingsNav } from "@/components/shared/settings-nav";

/** Settings section layout with sub-navigation */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row gap-6">
      <SettingsNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
