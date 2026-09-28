import { ChevronRight } from 'lucide-react';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { bookingDetailHref } from '@/features/dashboard/ai-assistant/lib/assistantEntityLinks';
import { useAssistantNavigate } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { useBooking } from '@/features/dashboard/bookings/hooks/useBooking';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';

type Props = Extract<ChatBlock, { type: 'booking_card' }>;

/**
 * Live booking card: the chat snapshot renders immediately, then status refreshes from the same
 * TanStack Query cache the Bookings pages use (so a confirmed change shows up here too).
 */
export function BookingCardBlock({
  bookingId,
  guestName,
  status,
  checkIn,
  checkOut,
  propertyName,
  balanceDue,
}: Props) {
  const orgSlug = useOrgSlugParam();
  const { data: live } = useBooking(bookingId || undefined, { propertyId: null, parkingId: null });
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const navigateTo = useAssistantNavigate();

  const liveStatus = live?.status ? String(live.status) : status;
  const href = live
    ? bookingDetailHref({
        orgSlug,
        bookingId,
        propertyId: live.property_id,
        parkingId: live.parking_id,
        properties: propertiesData?.properties,
        parkings: parkingsData?.parkings,
      })
    : null;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground truncate text-sm font-semibold" title={guestName}>
          {guestName || 'Guest'}
        </p>
        <StatusBadge status={liveStatus} />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="truncate">{propertyName}</span>
        <span className="tabular-nums">
          {checkIn} → {checkOut}
        </span>
        {balanceDue != null && (
          <span
            className={
              balanceDue > 0 ? 'text-destructive font-medium tabular-nums' : 'tabular-nums'
            }
          >
            Balance: ₱{balanceDue.toLocaleString()}
          </span>
        )}
      </div>
    </>
  );

  if (!href) {
    return <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => navigateTo(href)}
      aria-label={`Open booking for ${guestName || 'guest'}`}
      className="border-border/60 bg-card hover:bg-muted/40 focus-visible:ring-ring group flex w-full min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      <div className="min-w-0 flex-1 space-y-2">{body}</div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </button>
  );
}
