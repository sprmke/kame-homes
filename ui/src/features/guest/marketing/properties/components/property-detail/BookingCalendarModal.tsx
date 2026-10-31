import { CalendarDays, ArrowRight, Check } from 'lucide-react';

import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';
import { PublicPropertyCalendar } from '@/features/guest/property/components/PublicPropertyCalendar';

import { Button } from '@/components/ui/button';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

// ── Helpers ─────────────────────────────────────────────────────────────────

function toMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface BookingCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug: string;
  propertyName?: string;
  checkIn: Date | null;
  checkOut: Date | null;
  onDatesChange: (checkIn: Date | null, checkOut: Date | null) => void;
  /** When set, the primary action closes the calendar and opens the booking form flow. */
  onProceed?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BookingCalendarModal({
  open,
  onOpenChange,
  propertySlug,
  propertyName = '',
  checkIn,
  checkOut,
  onDatesChange,
  onProceed,
}: BookingCalendarModalProps) {
  const nightsCount =
    checkIn && checkOut
      ? Math.round(
          (toMidnight(checkOut).getTime() - toMidnight(checkIn).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

  const hasRange = checkIn !== null && checkOut !== null;
  const hasCheckIn = checkIn !== null;

  const stepTitle = hasRange
    ? `${nightsCount} night${nightsCount !== 1 ? 's' : ''} selected`
    : hasCheckIn
      ? 'Now select check-out date'
      : 'Select check-in date';

  const handlePrimaryAction = () => {
    if (!hasRange) return;
    if (onProceed) {
      onProceed();
      return;
    }
    onOpenChange(false);
  };

  return (
    <GuestDialogShell
      open={open}
      onOpenChange={onOpenChange}
      sizeClassName="max-w-[min(calc(100vw-1.5rem),30rem)] sm:max-w-[min(90vw,30rem)]"
      heightClassName="max-h-[min(90dvh,40rem)]"
      title={
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            {hasRange ? (
              <Check className="text-primary h-3.5 w-3.5" />
            ) : (
              <CalendarDays className="text-primary h-3.5 w-3.5" />
            )}
          </div>
          <ResponsiveModalTitle
            className={cn('text-base font-semibold', hasRange ? 'text-primary' : 'text-foreground')}
          >
            {stepTitle}
          </ResponsiveModalTitle>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onDatesChange(null, null)}
            disabled={!hasCheckIn}
            className={cn(
              'min-h-[44px] text-sm underline-offset-2 transition-colors',
              hasCheckIn
                ? 'text-muted-foreground hover:text-foreground cursor-pointer underline'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
            aria-label="Clear date selection"
          >
            Clear dates
          </button>

          <Button
            type="button"
            onClick={handlePrimaryAction}
            disabled={!hasRange}
            className="min-h-[44px] rounded-full px-6"
          >
            {hasRange ? (
              <span className="flex items-center gap-1.5">
                {onProceed ? 'Continue' : 'Save dates'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            ) : (
              'Select dates'
            )}
          </Button>
        </div>
      }
    >
      <PublicPropertyCalendar
        propertyName={propertyName}
        propertySlug={propertySlug}
        value={{ checkIn, checkOut }}
        onDatesChange={onDatesChange}
        showBookingAction={false}
        compact={true}
      />
    </GuestDialogShell>
  );
}
