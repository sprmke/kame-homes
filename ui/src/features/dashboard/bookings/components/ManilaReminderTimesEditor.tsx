import { Clock, Plus, Trash2 } from 'lucide-react';

import type { ManilaReminderSlot } from '@/features/dashboard/bookings/hooks/useTelegramMarketingSettings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function slotSort(a: ManilaReminderSlot, b: ManilaReminderSlot): number {
  return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
}

function slotToTimeInputValue(slot: ManilaReminderSlot): string {
  return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`;
}

function timeInputValueToSlot(value: string): ManilaReminderSlot | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatManilaTimeLabel(slot: ManilaReminderSlot): string {
  const d = new Date(2000, 0, 1, slot.hour, slot.minute);
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function sanitizeReminderSlots(slots: ManilaReminderSlot[]): ManilaReminderSlot[] {
  const mapped = slots.map((s) => ({
    hour: Math.max(0, Math.min(23, Math.round(s.hour))),
    minute: Math.max(0, Math.min(59, Math.round(s.minute))),
  }));
  const seen = new Set<number>();
  const out: ManilaReminderSlot[] = [];
  for (const s of [...mapped].sort(slotSort)) {
    const k = s.hour * 60 + s.minute;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.length > 0 ? out : [{ hour: 10, minute: 0 }];
}

const MAX_SLOTS = 8;

/** Fixed-width native time input — do not use w-full (overrides Input default). */
const TIME_INPUT_CLASS = 'h-10 min-h-[44px] w-[9.25rem] shrink-0 px-2.5 text-base sm:text-sm';

type Props = {
  slots: ManilaReminderSlot[];
  disabled?: boolean;
  onChange: (slots: ManilaReminderSlot[]) => void;
  className?: string;
};

export function ManilaReminderTimesEditor({ slots, disabled = false, onChange, className }: Props) {
  const sorted = [...slots].sort(slotSort);
  const atMax = slots.length >= MAX_SLOTS;
  const canRemove = slots.length > 1;

  function updateSlot(index: number, nextSlot: ManilaReminderSlot) {
    const next = [...slots];
    next[index] = nextSlot;
    onChange(sanitizeReminderSlots(next));
  }

  function removeSlot(index: number) {
    if (!canRemove) return;
    onChange(sanitizeReminderSlots(slots.filter((_, j) => j !== index)));
  }

  function addSlot() {
    if (atMax) return;
    const last = sorted[sorted.length - 1];
    const nextSlot: ManilaReminderSlot = {
      hour: Math.min(23, (last?.hour ?? 9) + 1),
      minute: last?.minute ?? 0,
    };
    onChange(sanitizeReminderSlots([...slots, nextSlot]));
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {sorted.length > 0 ? (
        <div className="flex flex-wrap gap-1" aria-label="Reminder schedule overview">
          {sorted.map((slot) => {
            const key = `${slot.hour}-${slot.minute}`;
            return (
              <span
                key={key}
                className="border-border/50 bg-muted/30 text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
              >
                <Clock className="text-muted-foreground size-2.5" aria-hidden />
                {formatManilaTimeLabel(slot)}
              </span>
            );
          })}
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {slots.map((slot, idx) => (
          <li
            key={`${slot.hour}-${slot.minute}-${idx}`}
            className="border-border/60 bg-card dark:bg-background/60 flex min-h-[44px] items-center gap-2 rounded-lg border px-2 py-1.5 shadow-[inset_0_1px_0_hsl(0_0%_100%_/0.04)] sm:gap-2.5 sm:px-2.5"
          >
            <span
              className="bg-muted/50 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
              aria-hidden
            >
              {idx + 1}
            </span>

            <Input
              id={`tg-slot-time-${idx}`}
              type="time"
              disabled={disabled}
              value={slotToTimeInputValue(slot)}
              aria-label={`Reminder time ${idx + 1}, ${formatManilaTimeLabel(slot)}`}
              className={TIME_INPUT_CLASS}
              onChange={(e) => {
                const parsed = timeInputValueToSlot(e.target.value);
                if (!parsed) return;
                updateSlot(idx, parsed);
              }}
            />

            <Button
              type="button"
              variant="ghost"
              disabled={disabled || !canRemove}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-auto h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 p-0"
              aria-label={`Remove reminder ${idx + 1}`}
              onClick={() => removeSlot(idx)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || atMax}
        onClick={addSlot}
        className="min-h-[44px] w-full gap-1.5 sm:w-auto"
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        Add reminder time
      </Button>

      <p className="text-muted-foreground text-[11px] leading-snug">
        {slots.length} of {MAX_SLOTS} daily sends · Manila time
        {atMax ? ' · max reached' : ''}
      </p>
    </div>
  );
}

type TimeSlot = { hour: number; minute: number };

type SingleTimeFieldProps = {
  slot: TimeSlot;
  disabled?: boolean;
  inputId: string;
  onChange: (slot: TimeSlot) => void;
  className?: string;
};

/** Single Manila time picker — compact fixed-width input, helper outside. */
export function ManilaTimeField({
  slot,
  disabled = false,
  inputId,
  onChange,
  className,
}: SingleTimeFieldProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1', className)}>
      <Input
        id={inputId}
        type="time"
        disabled={disabled}
        value={slotToTimeInputValue(slot)}
        aria-label={`Daily summary time, ${formatManilaTimeLabel(slot)}`}
        className={TIME_INPUT_CLASS}
        onChange={(e) => {
          const parsed = timeInputValueToSlot(e.target.value);
          if (!parsed) return;
          onChange(parsed);
        }}
      />
      <span className="text-muted-foreground text-[11px] leading-snug">Manila time</span>
    </div>
  );
}
