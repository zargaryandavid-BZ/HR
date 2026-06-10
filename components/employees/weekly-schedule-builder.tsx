"use client";

import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_DISPLAY_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_FULL_LABELS,
  generateTimeOptions,
  isEndAfterStart,
  slotsOverlap,
  type CustomScheduleConfig,
  type TimeSlot,
  type WeekdayKey,
} from "@/lib/schedule";

type WeeklyScheduleBuilderProps = {
  value: CustomScheduleConfig;
  onChange: (config: CustomScheduleConfig) => void;
  formError?: string;
  footer?: React.ReactNode;
};

const TIME_OPTIONS = generateTimeOptions();

/** Per-day weekly schedule builder for Fixed schedule type */
export function WeeklyScheduleBuilder({
  value,
  onChange,
  formError,
  footer,
}: WeeklyScheduleBuilderProps) {
  /** Update slots for a single weekday */
  function updateDay(day: WeekdayKey, slots: TimeSlot[]) {
    onChange({
      ...value,
      days: { ...value.days, [day]: slots },
    });
  }

  /** Mark day available with a default 9–5 slot */
  function makeAvailable(day: WeekdayKey) {
    updateDay(day, [{ start: "09:00", end: "17:00" }]);
  }

  /** Remove a slot; clearing all slots marks the day unavailable */
  function removeSlot(day: WeekdayKey, index: number) {
    const next = value.days[day].filter((_, i) => i !== index);
    updateDay(day, next);
  }

  /** Remove all slots for a day (mark unavailable) */
  function removeDay(day: WeekdayKey) {
    updateDay(day, []);
  }

  /** Add another slot after the last one on an available day */
  function addSlot(day: WeekdayKey) {
    const existing = value.days[day];
    const last = existing[existing.length - 1];
    const newStart = last ? last.end : "09:00";
    const newEnd = timeToEndDefault(newStart);
    updateDay(day, [...existing, { start: newStart, end: newEnd }]);
  }

  /** Patch a single slot field */
  function updateSlot(day: WeekdayKey, index: number, patch: Partial<TimeSlot>) {
    const slots = value.days[day].map((slot, i) =>
      i === index ? { ...slot, ...patch } : slot
    );
    updateDay(day, slots);
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <h4 className="font-medium text-sm mb-3">Weekly Schedule</h4>

      {SCHEDULE_DISPLAY_ORDER.map((day) => {
        const slots = value.days[day];
        const isAvailable = slots.length > 0;
        const dayOverlaps = isAvailable && slotsOverlap(slots);

        return (
          <div
            key={day}
            className="flex items-start gap-3 min-h-[52px] py-2 border-b border-border/50 last:border-0"
          >
            <DayChip day={day} available={isAvailable} />

            <div className="flex-1 min-w-0">
              {!isAvailable ? (
                <div className="flex items-center h-9 gap-3">
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                  <IconButton
                    label={`Make ${WEEKDAY_FULL_LABELS[day]} available`}
                    onClick={() => makeAvailable(day)}
                  >
                    <Plus className="h-4 w-4" />
                  </IconButton>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.map((slot, index) => {
                    const slotInvalid = !isEndAfterStart(slot.start, slot.end);
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <TimeSelect
                          value={slot.start}
                          onChange={(start) => updateSlot(day, index, { start })}
                        />
                        <span className="text-muted-foreground text-sm">–</span>
                        <TimeSelect
                          value={slot.end}
                          onChange={(end) => updateSlot(day, index, { end })}
                        />
                        {slots.length > 1 && (
                          <IconButton
                            label="Remove time slot"
                            onClick={() => removeSlot(day, index)}
                          >
                            <X className="h-4 w-4" />
                          </IconButton>
                        )}
                        {index === slots.length - 1 && (
                          <IconButton
                            label="Add time slot"
                            onClick={() => addSlot(day)}
                          >
                            <Plus className="h-4 w-4" />
                          </IconButton>
                        )}
                        {index === slots.length - 1 && (
                          <IconButton
                            label={`Remove ${WEEKDAY_FULL_LABELS[day]}`}
                            onClick={() => removeDay(day)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        )}
                        {slotInvalid && (
                          <p className="w-full text-xs text-destructive">
                            End time must be after start time
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {dayOverlaps && (
                    <p className="text-xs text-destructive">
                      Time slots must not overlap
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {formError && (
        <p className="text-sm text-destructive pt-2">{formError}</p>
      )}

      {footer && <div className="pt-4 border-t border-border/50">{footer}</div>}
    </div>
  );
}

/** Circular day-of-week chip */
function DayChip({ day, available }: { day: WeekdayKey; available: boolean }) {
  return (
    <div
      className={cn(
        "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-sm font-bold",
        available
          ? "bg-[#1e2a4a] text-white"
          : "bg-muted text-muted-foreground"
      )}
      title={WEEKDAY_FULL_LABELS[day]}
    >
      {WEEKDAY_LABELS[day]}
    </div>
  );
}

/** Pill-styled time dropdown */
function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-full bg-muted px-3 text-sm border-0 outline-none focus:ring-2 focus:ring-ring cursor-pointer appearance-none min-w-[5.5rem] text-center"
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {formatTimeDisplay(t)}
        </option>
      ))}
    </select>
  );
}

/** Outline circle action button */
function IconButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Format 24h time for display (e.g. 09:00 → 9:00 AM) */
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Pick a sensible default end time one hour after start (30-min grid, max 23:30) */
function timeToEndDefault(start: string): string {
  const startMins =
    parseInt(start.split(":")[0], 10) * 60 + parseInt(start.split(":")[1], 10);
  const endMins = Math.min(startMins + 60, 23 * 60 + 30);
  const rounded = Math.round(endMins / 30) * 30;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}