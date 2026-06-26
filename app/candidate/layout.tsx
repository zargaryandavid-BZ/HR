import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Job Offer — Bazaar Printing",
};

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {children}
      </div>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
