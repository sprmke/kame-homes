import { useState } from 'react';

import { Link } from 'react-router-dom';

import { ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';
import { GuestTripRow } from '@/features/guest/trip/components/GuestTripSection';
import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';
import { guestTripEditBookingPath } from '@/features/guest/trip/lib/guestTripLinks';

import type { ResolvedCancellationPolicyDisplay } from '@/features/dashboard/org/lib/propertyCancellationPolicy';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

function guestTripBookingReference(bookingId: string): string {
  return bookingId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

async function copyBookingId(bookingId: string) {
  try {
    await navigator.clipboard.writeText(bookingId);
    toast.success('Booking ID copied');
  } catch {
    toast.error('Could not copy');
  }
}

/**
 * What the guest entered, plus policy. Collapsed by default: guests rarely need their own
 * details, and the page stays short. Edit and cancel paths live here.
 */
export function GuestTripDetailsSection({
  trip,
  cancellationPolicy,
  showPolicy,
  messageHostPath,
  defaultOpen = false,
}: {
  trip: GuestTrip;
  cancellationPolicy: ResolvedCancellationPolicyDisplay | null;
  showPolicy: boolean;
  messageHostPath: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reference = guestTripBookingReference(trip.bookingId);
  const { stay } = trip;

  return (
    <section
      id="trip-details"
      aria-labelledby="trip-details-heading"
      className="border-border/70 scroll-mt-24 border-t pt-2"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="trip-details-heading" className="flex-1 text-base font-semibold tracking-tight">
            <CollapsibleTrigger className="focus-visible:ring-ring -mx-2 flex min-h-[52px] w-full items-center gap-2 rounded-xl px-2 text-left focus-visible:outline-none focus-visible:ring-2">
              Booking details
              <ChevronDown
                className={cn(
                  'text-muted-foreground size-4 transition-transform duration-200 motion-reduce:transition-none',
                  open && 'rotate-180'
                )}
                aria-hidden
              />
            </CollapsibleTrigger>
          </h2>
          <button
            type="button"
            onClick={() => void copyBookingId(trip.bookingId)}
            className="text-muted-foreground hover:text-foreground flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 font-mono text-xs"
            aria-label={`Copy booking reference ${reference}`}
          >
            {reference}
            <Copy className="size-3.5" aria-hidden />
          </button>
        </div>
        <CollapsibleContent>
          <div className="pb-1 pt-1">
            <dl className="divide-border/70 divide-y">
              <GuestTripRow label="Guests">
                {stay.adults} {stay.adults === 1 ? 'adult' : 'adults'}
                {stay.children > 0
                  ? `, ${stay.children} ${stay.children === 1 ? 'child' : 'children'}`
                  : ''}
              </GuestTripRow>
              {stay.guestNames.length > 0 ? (
                <GuestTripRow label="Names">
                  <span className="block [overflow-wrap:anywhere]">
                    {stay.guestNames.join(', ')}
                  </span>
                </GuestTripRow>
              ) : null}
              {trip.pet ? (
                <GuestTripRow label="Pet">
                  {trip.pet.name}
                  {trip.pet.type ? ` (${trip.pet.type})` : ''}
                </GuestTripRow>
              ) : null}
              {stay.email ? (
                <GuestTripRow label="Email">
                  <span className="[overflow-wrap:anywhere]">{stay.email}</span>
                </GuestTripRow>
              ) : null}
              {stay.phone ? <GuestTripRow label="Phone">{stay.phone}</GuestTripRow> : null}
              {stay.specialRequests ? (
                <GuestTripRow label="Requests">
                  <span className="block whitespace-pre-line text-left [overflow-wrap:anywhere]">
                    {stay.specialRequests}
                  </span>
                </GuestTripRow>
              ) : null}
            </dl>

            {trip.actions.canEditBooking ? (
              <Link
                to={guestTripEditBookingPath(trip)}
                className="text-foreground mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-4"
              >
                Edit booking details
              </Link>
            ) : null}

            {showPolicy && cancellationPolicy ? (
              <div className="bg-muted/50 mt-4 rounded-2xl p-4">
                <h3 className="text-sm font-semibold">{cancellationPolicy.title}</h3>
                {cancellationPolicy.description ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {cancellationPolicy.description}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-2 text-sm">
                  To cancel or change dates,{' '}
                  <Link
                    to={messageHostPath}
                    className="text-foreground font-semibold underline underline-offset-4"
                  >
                    message your host
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            <Link
              to={guestPropertyPath(trip.property.slug)}
              className="text-muted-foreground hover:text-foreground mt-2 inline-flex min-h-[44px] items-center text-sm"
            >
              View listing
            </Link>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
