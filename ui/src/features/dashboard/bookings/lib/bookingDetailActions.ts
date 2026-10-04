import {
  CalendarClock,
  Car,
  ClipboardCheck,
  Copy,
  ExternalLink,
  PawPrint,
  Search,
  Sparkles,
} from 'lucide-react';

import type { BookingEditTabId } from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditTabs';
import type { BookingGuestFormCompletionLink } from '@/features/dashboard/bookings/hooks/useBookingGuestFormCompletionLink';
import type { BookingParkingShareLink } from '@/features/dashboard/bookings/hooks/useBookingParkingShareLink';
import type { BookingStayGuideLink } from '@/features/dashboard/bookings/hooks/useBookingStayGuideLink';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import type { LucideIcon } from 'lucide-react';

export type BookingDetailAction = {
  key: string;
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
  /** Consecutive actions sharing a group render together; a change draws a divider. */
  group: 'reschedule' | 'edit' | 'guest-links';
  /** Shows the plan pill when the property is below this feature's tier. */
  planFeature?: PlanFeatureKey;
};

type Args = {
  booking: BookingRow;
  onEdit: (tab?: BookingEditTabId) => void;
  /** Opens the reschedule calendar (`RescheduleBookingModal`). */
  onReschedule?: () => void;
  /** Opens own-default or marketplace find (sets need_parking if needed). */
  onFindParking: () => void;
  /** Opens marketplace search even when an own default exists. */
  onSearchOtherParkings?: () => void;
  onOpenAiSummary?: () => void;
  stayGuide: BookingStayGuideLink;
  /** OTA-ingested bookings only: copy the "finish the guest form" link for the Airbnb guest. */
  guestFormCompletion?: BookingGuestFormCompletionLink;
  parkingShareLink: BookingParkingShareLink;
  /** When false, hide AI Summary (needs `bookings.detail.stay:edit`). */
  canRunAiSummary?: boolean;
  /** When false, hide Add/Edit parking. */
  canEditParking?: boolean;
  /** When false, hide Add/Edit pets. */
  canEditPets?: boolean;
  /** When false, hide Find parking / guest parking link actions. */
  canManagePayParking?: boolean;
  /** Show the Reschedule row — gated on stay-edit permission + a pre-check-out status. */
  canReschedule?: boolean;
  /** Prefer "Use your parking" label when org owns an available default. */
  hasOwnDefaultParking?: boolean;
};

/**
 * Secondary host actions for view mode — shown behind one overflow trigger so
 * "Edit booking" stays the only primary action on the page.
 * Workflow transitions belong to the Progress rail, not here.
 */
export function buildBookingDetailActions({
  booking,
  onEdit,
  onReschedule,
  onFindParking,
  onSearchOtherParkings,
  onOpenAiSummary,
  stayGuide,
  guestFormCompletion,
  parkingShareLink,
  canRunAiSummary = true,
  canEditParking = true,
  canEditPets = true,
  canManagePayParking = true,
  canReschedule = false,
  hasOwnDefaultParking = false,
}: Args): BookingDetailAction[] {
  const actions: BookingDetailAction[] = [
    ...(onReschedule && canReschedule
      ? [
          {
            key: 'reschedule',
            label: 'Reschedule',
            Icon: CalendarClock,
            onSelect: onReschedule,
            group: 'reschedule' as const,
          },
        ]
      : []),
    ...(onOpenAiSummary && canRunAiSummary
      ? [
          {
            key: 'ai-summary',
            label: 'AI Summary',
            Icon: Sparkles,
            onSelect: onOpenAiSummary,
            group: 'edit' as const,
          },
        ]
      : []),
    ...(canEditParking
      ? [
          {
            key: 'parking',
            label: booking.need_parking === true ? 'Edit parking' : 'Add parking',
            Icon: Car,
            onSelect: () => onEdit('parking'),
            group: 'edit' as const,
          },
        ]
      : []),
    ...(canEditPets
      ? [
          {
            key: 'pets',
            label: booking.has_pets === true ? 'Edit pets' : 'Add pets',
            Icon: PawPrint,
            onSelect: () => onEdit('pets'),
            group: 'edit' as const,
          },
        ]
      : []),
    ...(canManagePayParking
      ? [
          {
            key: 'find-parking',
            label: hasOwnDefaultParking ? 'Use your parking' : 'Find parking',
            Icon: ExternalLink,
            onSelect: onFindParking,
            group: 'edit' as const,
          },
          ...(hasOwnDefaultParking && onSearchOtherParkings
            ? [
                {
                  key: 'search-other-parkings',
                  label: 'Search other parkings',
                  Icon: Search,
                  onSelect: onSearchOtherParkings,
                  group: 'edit' as const,
                },
              ]
            : []),
        ]
      : []),
  ];

  // Only once the token exists — a menu row that silently does nothing while the
  // link is still being minted is worse than no row.
  if (stayGuide.locked) {
    // Below Pro: one row that explains the upgrade instead of a link the guest can't open.
    actions.push({
      key: 'stay-guide-upgrade',
      label: 'Stay guide link',
      Icon: ExternalLink,
      onSelect: stayGuide.upgrade,
      group: 'guest-links',
      planFeature: 'propertyShowcase',
    });
  } else if (stayGuide.url) {
    actions.push(
      {
        key: 'stay-guide-open',
        label: 'Open stay guide',
        Icon: ExternalLink,
        onSelect: stayGuide.open,
        group: 'guest-links',
      },
      {
        key: 'stay-guide-copy',
        label: 'Copy stay guide link',
        Icon: Copy,
        onSelect: stayGuide.copy,
        group: 'guest-links',
      }
    );
  }

  // OTA-ingested booking still awaiting review — let the host forward the completion form.
  if (guestFormCompletion?.eligible) {
    actions.push({
      key: 'guest-form-completion-copy',
      label: guestFormCompletion.pending ? 'Creating guest form link…' : 'Copy guest form link',
      Icon: ClipboardCheck,
      onSelect: guestFormCompletion.copy,
      group: 'guest-links',
    });
  }

  if (parkingShareLink.url) {
    actions.push(
      {
        key: 'parking-share-open',
        label: parkingShareLink.isOwnDefault ? 'Open your parking page' : 'Open guest parking page',
        Icon: ExternalLink,
        onSelect: parkingShareLink.open,
        group: 'guest-links',
      },
      {
        key: 'parking-share-copy',
        label: parkingShareLink.isOwnDefault ? 'Copy your parking link' : 'Copy guest parking link',
        Icon: Copy,
        onSelect: parkingShareLink.copy,
        group: 'guest-links',
      }
    );
  }

  if (parkingShareLink.isOwnDefault && parkingShareLink.searchUrl) {
    actions.push(
      {
        key: 'parking-search-open',
        label: 'Open parking search',
        Icon: Search,
        onSelect: parkingShareLink.openSearch,
        group: 'guest-links',
      },
      {
        key: 'parking-search-copy',
        label: 'Copy parking search link',
        Icon: Copy,
        onSelect: parkingShareLink.copySearch,
        group: 'guest-links',
      }
    );
  }

  return actions;
}
