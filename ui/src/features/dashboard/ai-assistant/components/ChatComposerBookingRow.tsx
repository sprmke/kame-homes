import { CalendarDays } from 'lucide-react';

import {
  bookingGuestName,
  bookingStayRange,
} from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { cn } from '@/lib/utils';

export function ChatComposerBookingRow({
  row,
  selected,
  hint,
  onSelect,
}: {
  row: BookingRow;
  selected: boolean;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2',
        selected ? 'bg-primary/10' : 'hover:bg-muted/60'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">
          {bookingGuestName(row)}
        </span>
        <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
          <CalendarDays className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{bookingStayRange(row)}</span>
          {hint ? <span className="text-primary shrink-0 font-medium">{hint}</span> : null}
        </span>
      </span>
      <StatusBadge
        status={row.status}
        className="max-w-[8.5rem] shrink-0 px-1.5 py-0 text-[10px] font-semibold"
      />
    </button>
  );
}
