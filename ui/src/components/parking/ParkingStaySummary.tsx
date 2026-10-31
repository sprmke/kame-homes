import { CalendarDays, Moon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { countParkingStayNights, formatParkingStayRange } from '@/utils/format/parkingStayDisplay';

type Props = {
  checkIn: string;
  checkOut: string;
  organizationName?: string | null;
  className?: string;
  compact?: boolean;
};

export function ParkingStaySummary({
  checkIn,
  checkOut,
  organizationName,
  className,
  compact = false,
}: Props) {
  const rangeLabel = formatParkingStayRange(checkIn, checkOut);
  const nights = countParkingStayNights(checkIn, checkOut);

  if (!rangeLabel) return null;

  return (
    <div
      className={cn(
        'bg-muted/40 flex items-start gap-3 rounded-xl px-4 py-3.5',
        compact && 'px-3 py-3',
        className
      )}
    >
      <CalendarDays className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground text-sm font-semibold tracking-tight">{rangeLabel}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
          {nights != null && nights > 0 && (
            <span className="inline-flex items-center gap-1">
              <Moon className="h-3 w-3 shrink-0" aria-hidden />
              {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          )}
          {organizationName ? (
            <>
              {nights != null && nights > 0 ? (
                <span className="text-border" aria-hidden>
                  ·
                </span>
              ) : null}
              <span className="truncate">{organizationName}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
