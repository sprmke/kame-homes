import { Link } from 'react-router-dom';

import { ChevronLeft } from 'lucide-react';

import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import { guestTripPath } from '@/features/guest/lib/guestPublicPaths';

import { cn } from '@/lib/utils';

/** "Your trip" link back to the trip hub from single-purpose booking pages (SD form, review). */
export function GuestTripBackLink({
  bookingId,
  className,
}: {
  bookingId: string;
  className?: string;
}) {
  const propertySlug = useGuestPropertySlug();
  if (!bookingId.trim() || !propertySlug) return null;
  return (
    <Link
      to={guestTripPath(propertySlug, bookingId)}
      className={cn(
        'text-muted-foreground hover:text-foreground -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm',
        className
      )}
    >
      <ChevronLeft className="size-4" aria-hidden />
      Your trip
    </Link>
  );
}
