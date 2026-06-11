import { ClockStationClient } from "@/components/timesheet/clock-station-client";
import { LiveClock } from "@/components/timesheet/live-clock";

/** Standalone clock station — opens in popup window, no sidebar */
export default function ClockStationPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#0F6E56] flex items-center justify-center text-white text-xs font-bold">
            B
          </div>
          <span className="text-sm font-semibold text-slate-700">Bazaar HR — Clock Station</span>
        </div>
        <LiveClock />
      </header>

      {/* Clock station */}
      <div className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-sm">
          <ClockStationClient />
        </div>
      </div>
    </div>
  );
}
