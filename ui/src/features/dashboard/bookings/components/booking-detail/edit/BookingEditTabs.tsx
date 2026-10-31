/**
 * Real-tabs shell for the booking edit form — replaces `BookingEditShell`
 * (banner + ring container) and the old scroll-anchor `EditSectionJumpNav`.
 *
 * Owns local tab state (not a URL param — edit mode itself is transient).
 * Tab labels mirror view-mode `BookingDetailTabs` where the domains overlap
 * (Guests / Parking / Pets); Stay leads the strip and is edit-only. Each tab
 * owns its own `BookingDetailCard`(s) so edit and view share one card language.
 * Document uploads live on Stay (downpayment), Guests (Valid ID), and Pets
 * (vaccination / photo). Pricing and settlement edits live on the Progress rail.
 * The single `useForm` instance stays in `BookingEditForm.tsx` — RHF keeps
 * every field's value even while its tab isn't mounted.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { PencilLine } from 'lucide-react';

import {
  BookingEditActions,
  type BookingEditActionsProps,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditStickyBar';
import {
  BookingDetailShell,
  BookingDetailShellBody,
  BookingDetailShellHeader,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailShell';
import type { BookingEditFormValues } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { ReadyForCheckinSensitiveFieldsNotice } from '@/features/dashboard/bookings/components/ReadyForCheckinSensitiveFieldsNotice';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';
import { formatBookingDate } from '@/utils/format/bookingDisplay';

import type { FieldErrors } from 'react-hook-form';

export type BookingEditTabId = 'guest' | 'stay' | 'parking' | 'pets';

const TAB_ORDER: BookingEditTabId[] = ['stay', 'guest', 'parking', 'pets'];

/** Labels aligned with view-mode tabs where domains overlap (Guests). */
const TAB_LABEL: Record<BookingEditTabId, string> = {
  stay: 'Stay',
  guest: 'Guests',
  parking: 'Parking',
  pets: 'Pets',
};

/** Maps every RHF-registered top-level field to the tab that owns it, for error-dot badges and cross-tab error jump. */
const FIELD_TO_TAB: Partial<Record<keyof BookingEditFormValues, BookingEditTabId>> = {
  booking_source: 'guest',
  guest_facebook_name: 'guest',
  primary_guest_name: 'guest',
  guest_email: 'guest',
  guest_phone_number: 'guest',
  guest_address: 'guest',
  nationality: 'guest',
  primary_guest_age: 'guest',
  guest2_name: 'guest',
  guest2_age: 'guest',
  guest3_name: 'guest',
  guest3_age: 'guest',
  guest4_name: 'guest',
  guest4_age: 'guest',
  guest5_name: 'guest',
  guest5_age: 'guest',
  find_us: 'guest',
  find_us_details: 'guest',
  guest_special_requests: 'guest',
  guest_requests_surprise_decor: 'guest',
  check_in_date: 'stay',
  check_out_date: 'stay',
  check_in_time: 'stay',
  check_out_time: 'stay',
  number_of_adults: 'stay',
  number_of_children: 'stay',
  number_of_nights: 'stay',
  need_parking: 'parking',
  car_plate_number: 'parking',
  car_brand_model: 'parking',
  car_color: 'parking',
  has_pets: 'pets',
  pet_name: 'pets',
  pet_type: 'pets',
  pet_breed: 'pets',
  pet_age: 'pets',
  pet_vaccination_date: 'pets',
};

function scrollToFirstInvalidField(errors: FieldErrors<BookingEditFormValues>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;
  const byDataField = document.querySelector(`[data-field="${firstKey}"]`);
  const byInvalid = document.querySelector('[aria-invalid="true"]');
  (byDataField ?? byInvalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function tabsWithErrorsFrom(errors: FieldErrors<BookingEditFormValues>): Set<BookingEditTabId> {
  const set = new Set<BookingEditTabId>();
  (Object.keys(errors) as (keyof BookingEditFormValues)[]).forEach((key) => {
    const tab = FIELD_TO_TAB[key];
    if (tab) set.add(tab);
  });
  return set;
}

export type BookingEditTabsHandle = {
  /** Called from the form's `onInvalid` handler — switches to the first errored tab and scrolls to the field. */
  focusFirstError: (errors: FieldErrors<BookingEditFormValues>) => void;
};

type Props = {
  booking: BookingRow;
  /** Cancel + Save in the editing header (same props as the sticky footer). */
  actions: Omit<BookingEditActionsProps, 'density'>;
  errors: FieldErrors<BookingEditFormValues>;
  sensitiveNoticeVisible: boolean;
  /** Content for each tab, built by `BookingEditForm.tsx` from the shared `useForm` instance. */
  tabs: Partial<Record<BookingEditTabId, ReactNode>>;
  footer: ReactNode;
  /** Open on a specific tab (e.g. Add parking → parking). */
  initialTab?: BookingEditTabId;
  /** Subset of tabs the member may edit (permission-gated). */
  allowedTabs?: BookingEditTabId[];
};

export const BookingEditTabs = forwardRef<BookingEditTabsHandle, Props>(function BookingEditTabs(
  {
    booking,
    actions,
    errors,
    sensitiveNoticeVisible,
    tabs,
    footer,
    initialTab = 'stay',
    allowedTabs,
  },
  ref
) {
  const orderedTabs = useMemo(
    () =>
      allowedTabs?.length
        ? TAB_ORDER.filter((id) => allowedTabs.includes(id) && tabs[id] != null)
        : TAB_ORDER.filter((id) => tabs[id] != null),
    [allowedTabs, tabs]
  );
  const [activeTab, setActiveTab] = useState<BookingEditTabId>(() =>
    orderedTabs.includes(initialTab) ? initialTab : (orderedTabs[0] ?? 'stay')
  );
  const pendingScrollErrorsRef = useRef<FieldErrors<BookingEditFormValues> | null>(null);

  useEffect(() => {
    if (orderedTabs.length === 0) return;
    if (!orderedTabs.includes(activeTab)) {
      setActiveTab(orderedTabs[0]!);
    }
  }, [orderedTabs, activeTab]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirstError(fieldErrors) {
        const errorTabs = tabsWithErrorsFrom(fieldErrors);
        const targetTab = orderedTabs.find((id) => errorTabs.has(id));
        if (targetTab && targetTab !== activeTab) {
          pendingScrollErrorsRef.current = fieldErrors;
          setActiveTab(targetTab);
        } else {
          requestAnimationFrame(() => scrollToFirstInvalidField(fieldErrors));
        }
      },
    }),
    [orderedTabs, activeTab]
  );

  // Runs after the target tab (set by focusFirstError above) has mounted its fields.
  useEffect(() => {
    const pending = pendingScrollErrorsRef.current;
    if (!pending) return;
    pendingScrollErrorsRef.current = null;
    const raf = requestAnimationFrame(() => scrollToFirstInvalidField(pending));
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  const tabsWithErrors = useMemo(() => tabsWithErrorsFrom(errors), [errors]);

  const options: SegmentedControlOption<BookingEditTabId>[] = orderedTabs.map((id) => ({
    value: id,
    label: TAB_LABEL[id],
    className: cn(
      'relative',
      tabsWithErrors.has(id) &&
        "after:bg-destructive after:absolute after:right-1 after:top-1 after:size-1.5 after:rounded-full after:content-['']"
    ),
  }));

  const guestLabel =
    booking.guest_facebook_name?.trim() || booking.primary_guest_name?.trim() || 'Booking';

  return (
    <BookingDetailShell mode="edit">
      <BookingDetailShellHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <span className="icon-well-sm inline-flex !size-8 shrink-0 items-center justify-center sm:!size-9">
            <PencilLine className="text-primary size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold tracking-tight sm:text-base">
              Editing booking
            </p>
            <p className="text-muted-foreground min-w-0 truncate text-xs font-medium">
              <span className="[overflow-wrap:anywhere]">{guestLabel}</span>
              <span className="text-muted-foreground/50 mx-1" aria-hidden>
                ·
              </span>
              {formatBookingDate(booking.check_in_date)}
              <span className="text-muted-foreground/50 mx-1" aria-hidden>
                →
              </span>
              {formatBookingDate(booking.check_out_date)}
            </p>
          </div>
        </div>
        <BookingEditActions {...actions} density="header" />
      </BookingDetailShellHeader>

      <BookingDetailShellBody>
        <ReadyForCheckinSensitiveFieldsNotice visible={sensitiveNoticeVisible} />

        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={options}
          size="compact"
          aria-label="Edit booking sections"
          className="max-w-full"
        />

        <div className="min-w-0 space-y-4">{tabs[activeTab]}</div>
      </BookingDetailShellBody>

      {footer}
    </BookingDetailShell>
  );
});
