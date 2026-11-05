import { useState } from 'react';

import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { CalendarDayBookingCard } from '@/features/dashboard/bookings/components/calendar/CalendarDayBookingCard';
import { useIssueGuestFormCompletionToken } from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { bookingDetailPath } from '@/features/dashboard/org/lib/tenantPaths';
import {
  isCompletionLinkLive,
  isImportedBooking,
  isImportedPendingBooking,
} from '@/features/dashboard/pricing/lib/importedBooking';
import type { PropertyPricingCalendarBooking } from '@/features/dashboard/pricing/lib/propertyPricingApi';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  booking: PropertyPricingCalendarBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved booking_rate, or property default stay total when unset. */
  displayAmount?: number | null;
  /** Mirrors `bookings.detail.workflow:edit` — the edge rejects the mint without it. */
  canCopyGuestFormLink?: boolean;
};

export function PricingCalendarBookingModal({
  booking,
  open,
  onOpenChange,
  displayAmount,
  canCopyGuestFormLink = false,
}: Props) {
  const navigate = useNavigate();
  const { orgSlug, propertySlug } = useOrgContext();
  const issueToken = useIssueGuestFormCompletionToken(booking?.id);
  const [copying, setCopying] = useState(false);

  if (!booking) return null;

  const imported = isImportedBooking(booking);
  const canCopy =
    canCopyGuestFormLink && isImportedPendingBooking(booking) && isCompletionLinkLive(booking);
  const reservationUrl = booking.reservation_url?.startsWith('https://')
    ? booking.reservation_url
    : null;

  const handleCopy = async () => {
    setCopying(true);
    try {
      const result = await issueToken.mutateAsync();
      const url = result.data?.completionUrl;
      if (!url) {
        toast.error('Could not create the guest form link');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Guest form link copied. Send it in Airbnb');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not copy link');
    } finally {
      setCopying(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="max-w-[min(calc(100vw-1.5rem),24rem)] gap-0 overflow-hidden !p-0"
      >
        <ResponsiveModalHeader className="border-border/60 space-y-0 border-b px-4 py-3 pr-14 text-left sm:px-5">
          <ResponsiveModalTitle className="flex min-h-[44px] items-center text-base font-semibold leading-none sm:text-lg">
            Booking Details
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="p-2 sm:p-3">
          <CalendarDayBookingCard
            row={booking}
            amount={{
              mode: 'booking_rate',
              amount: displayAmount ?? booking.booking_rate,
            }}
            onOpen={() => {
              onOpenChange(false);
              navigate(bookingDetailPath(orgSlug, propertySlug, booking.id));
            }}
          />
        </div>

        {imported ? (
          <div className="border-border/60 space-y-1 border-t p-2 sm:p-3">
            {canCopy ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full justify-start gap-2"
                onClick={handleCopy}
                disabled={copying || issueToken.isPending}
              >
                {copying || issueToken.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                Copy guest form link
              </Button>
            ) : null}
            {reservationUrl ? (
              <Button asChild variant="ghost" className="min-h-[44px] w-full justify-start gap-2">
                <a href={reservationUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  Open in Airbnb
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
