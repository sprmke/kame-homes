import { Link } from 'react-router-dom';

import { ChevronRight, Luggage } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import { useGuestTrips } from '@/features/guest/account/hooks/useGuestTrips';
import type { GuestTripListItemDto } from '@/features/guest/account/lib/guestAccountApi';
import { guestTripPath } from '@/features/guest/lib/guestPublicPaths';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { GuestTripStatusPill } from '@/features/guest/trip/components/GuestTripStatusPill';
import {
  guestTripListGroup,
  guestTripStatusLabel,
  guestTripStatusTone,
} from '@/features/guest/trip/lib/guestTripPhase';

import { GuestVouchersPageSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';
import { formatStayDateRange, getManilaYmdToday } from '@/utils/format/dates';

const GROUPS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

function TripRow({ trip }: { trip: GuestTripListItemDto & { propertySlug: string } }) {
  const cancelled = trip.status === 'CANCELLED';
  return (
    <li>
      <Link
        to={guestTripPath(trip.propertySlug, trip.id)}
        className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-[72px] items-center gap-3 rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg sm:size-16">
          {trip.imageUrl ? (
            <Image
              src={trip.imageUrl}
              alt=""
              fill
              sizes="64px"
              className={cn('object-cover', cancelled && 'grayscale')}
            />
          ) : (
            <Luggage className="text-muted-foreground absolute inset-0 m-auto size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{trip.propertyName ?? 'Stay'}</p>
          <p className="text-muted-foreground truncate text-xs">
            {formatStayDateRange(trip.checkInDate, trip.checkOutDate) ?? ''}
          </p>
          <GuestTripStatusPill
            className="mt-1.5"
            label={guestTripStatusLabel(trip.status)}
            tone={guestTripStatusTone(trip.status)}
          />
        </div>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

export function GuestTripsPage() {
  usePageTitle(publicPageTitle('Trips'));
  const { data: trips = [], isLoading, isError, refetch } = useGuestTrips();
  const today = getManilaYmdToday();

  if (isLoading) {
    return (
      <GuestAccountContentCard>
        <GuestVouchersPageSkeleton rows={3} />
      </GuestAccountContentCard>
    );
  }

  if (isError) {
    return (
      <GuestAccountEmptyState message="Could not load your trips.">
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-primary mt-4 inline-flex min-h-[44px] items-center text-sm font-medium"
        >
          Try again
        </button>
      </GuestAccountEmptyState>
    );
  }

  const linkable = trips.filter((trip): trip is GuestTripListItemDto & { propertySlug: string } =>
    Boolean(trip.propertySlug)
  );

  if (linkable.length === 0) {
    return (
      <GuestAccountEmptyState
        message="No trips yet."
        actionLabel="Browse properties"
        actionHref="/properties"
      />
    );
  }

  const grouped = GROUPS.map((group) => ({
    ...group,
    trips: linkable.filter(
      (trip) =>
        guestTripListGroup({
          status: trip.status,
          checkOutYmd: trip.checkOutDate,
          todayYmd: today,
        }) === group.key
    ),
  })).filter((group) => group.trips.length > 0);

  // Upcoming reads best soonest-first; the API returns newest check-in first.
  const upcoming = grouped.find((group) => group.key === 'upcoming');
  if (upcoming) upcoming.trips = [...upcoming.trips].reverse();

  return (
    <GuestAccountContentCard bodyClassName="p-2 sm:p-4">
      <div className="space-y-4">
        {grouped.map((group) => (
          <section key={group.key} aria-labelledby={`trips-${group.key}`} className="space-y-1">
            <h2
              id={`trips-${group.key}`}
              className="text-muted-foreground px-2 pt-2 text-xs font-semibold uppercase tracking-wider"
            >
              {group.label}
            </h2>
            <ul className="space-y-0.5">
              {group.trips.map((trip) => (
                <TripRow key={trip.id} trip={trip} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </GuestAccountContentCard>
  );
}
