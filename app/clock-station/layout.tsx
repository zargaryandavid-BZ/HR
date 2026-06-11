import type { ReactNode } from "react";
import { Toaster } from "sonner";

/** Standalone clock station layout — no sidebar, used in popup window */
export default function ClockStationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-center" richColors />
    </>
  );
}
