/**
 * BookingEditForm — inline edit form for all guest booking fields.
 *
 * Shown in the left column of BookingDetailPage when the admin clicks "Edit".
 * While the booking is in **Pending documents** (parent or GAF / parking / pet)
 * or **Ready for check-in**, saving **workflow-sensitive** guest/stay fields
 * reverts status to PENDING_REVIEW (see `hasWorkflowSensitiveGuestFieldDiff`
 * + docs/todos/). Other edits keep status unchanged.
 *
 * Uses React Hook Form (no Zod for now — lightweight admin-only form). Field
 * JSX lives in `booking-detail/edit/tabs/*` — this file owns the single
 * `useForm` instance, save/submit logic, and workflow-sensitive-field
 * detection; RHF keeps every field's value even while its tab isn't mounted
 * (default `shouldUnregister: false`).
 */

import React, { useRef, useState } from 'react';

import {
  useForm,
  useWatch,
  type FieldErrors,
  type SubmitErrorHandler,
  type SubmitHandler,
} from 'react-hook-form';
import { toast } from 'sonner';

import { normalizeBookingSource } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import {
  computeGuestCounts,
  getActivePartySize,
  getDefaultAgeForPartyGuest,
  getInitialVisibleGuestCount,
  MAX_GUESTS,
} from '@/features/guest/form/lib/guestCounts';
import { guestBookedDatesUrl } from '@/features/guest/form/lib/guestPropertyScope';
import { countParkingNights } from '@/features/guest/pay-parking/lib/payParkingHelpers';

import { BookingEditStickyBar } from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditStickyBar';
import {
  BookingEditTabs,
  type BookingEditTabId,
  type BookingEditTabsHandle,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditTabs';
import { GuestIdentityTab } from '@/features/dashboard/bookings/components/booking-detail/edit/tabs/GuestIdentityTab';
import { ParkingTab } from '@/features/dashboard/bookings/components/booking-detail/edit/tabs/ParkingTab';
import { PetsTab } from '@/features/dashboard/bookings/components/booking-detail/edit/tabs/PetsTab';
import { StayDetailsTab } from '@/features/dashboard/bookings/components/booking-detail/edit/tabs/StayDetailsTab';
import type {
  AdditionalGuestSlotConfig,
  BookingEditFormValues,
} from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { BookingEditSaveChoiceDialog } from '@/features/dashboard/bookings/components/BookingEditSaveChoiceDialog';
import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  useUpdateBooking,
  type UpdateBookingPayload,
} from '@/features/dashboard/bookings/hooks/useUpdateBooking';
import { shouldRevertGuestFieldEditsToPendingReview } from '@/features/dashboard/bookings/lib/bookingStatus';
import { DEFAULT_DOCUMENT_REQUIREMENTS } from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { hasWorkflowSensitiveGuestFieldDiff } from '@/features/dashboard/bookings/lib/workflowSensitiveGuestDiff';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { captureAppEvent } from '@/lib/posthog/capture';
import { normalizeDateString, type BookedDateRange } from '@/utils/format/dates';

export {
  bookingEditDatePickerClass,
  type AdditionalGuestSlotConfig,
  type BookingEditFormValues,
} from '@/features/dashboard/bookings/components/bookingEditFormShared';

type Props = {
  booking: BookingRow;
  onClose: () => void;
  onSaved: (updated: BookingRow) => void;
  /** Same handler as view-mode doc previews — opens in-page modal (resolved URL for private buckets). */
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
  /** Open edit mode on a specific tab (Add parking / Add pets). */
  initialTab?: BookingEditTabId;
  /** Tabs the member may edit (`bookings.detail.*:edit`). Defaults to all four. */
  allowedTabs?: BookingEditTabId[];
};

type FormValues = BookingEditFormValues;

function toStr(v: string | null | undefined) {
  return v ?? '';
}

function toAge(v: number | null | undefined): number | '' {
  if (v != null && !Number.isNaN(v)) return v;
  return '';
}

function getInitialVisibleAdditionalGuestCount(booking: BookingRow): number {
  const partyCount = getInitialVisibleGuestCount([
    { name: booking.primary_guest_name ?? undefined, age: booking.primary_guest_age ?? undefined },
    { name: booking.guest2_name ?? undefined, age: booking.guest2_age ?? undefined },
    { name: booking.guest3_name ?? undefined, age: booking.guest3_age ?? undefined },
    { name: booking.guest4_name ?? undefined, age: booking.guest4_age ?? undefined },
    { name: booking.guest5_name ?? undefined, age: booking.guest5_age ?? undefined },
  ]);
  return Math.max(0, partyCount - 1);
}

const ADDITIONAL_GUEST_SLOTS: AdditionalGuestSlotConfig[] = [
  {
    partyPosition: 2,
    nameField: 'guest2_name',
    ageField: 'guest2_age',
    validIdUrlKey: 'guest2_valid_id_url',
    assetType: 'guest2_valid_id',
  },
  {
    partyPosition: 3,
    nameField: 'guest3_name',
    ageField: 'guest3_age',
    validIdUrlKey: 'guest3_valid_id_url',
    assetType: 'guest3_valid_id',
  },
  {
    partyPosition: 4,
    nameField: 'guest4_name',
    ageField: 'guest4_age',
    validIdUrlKey: 'guest4_valid_id_url',
    assetType: 'guest4_valid_id',
  },
  {
    partyPosition: 5,
    nameField: 'guest5_name',
    ageField: 'guest5_age',
    validIdUrlKey: 'guest5_valid_id_url',
    assetType: 'guest5_valid_id',
  },
];

function normalizeGuestAge(value: number | ''): number | null {
  if (value === '' || Number.isNaN(value)) return null;
  return value;
}

function bookingEditPayloadFromValues(values: FormValues): UpdateBookingPayload {
  return {
    booking_source: normalizeBookingSource(values.booking_source),
    guest_facebook_name: values.guest_facebook_name,
    primary_guest_name: values.primary_guest_name,
    guest_email: values.guest_email,
    guest_phone_number: values.guest_phone_number,
    guest_address: values.guest_address || null,
    nationality: values.nationality || null,
    primary_guest_age: normalizeGuestAge(values.primary_guest_age),
    guest2_name: values.guest2_name || null,
    guest2_age: values.guest2_name.trim() ? normalizeGuestAge(values.guest2_age) : null,
    guest3_name: values.guest3_name || null,
    guest3_age: values.guest3_name.trim() ? normalizeGuestAge(values.guest3_age) : null,
    guest4_name: values.guest4_name || null,
    guest4_age: values.guest4_name.trim() ? normalizeGuestAge(values.guest4_age) : null,
    guest5_name: values.guest5_name || null,
    guest5_age: values.guest5_name.trim() ? normalizeGuestAge(values.guest5_age) : null,
    check_in_date: values.check_in_date,
    check_out_date: values.check_out_date,
    check_in_time: values.check_in_time || null,
    check_out_time: values.check_out_time || null,
    number_of_adults: Number(values.number_of_adults),
    number_of_children: Number(values.number_of_children) || null,
    number_of_nights: Number(values.number_of_nights),
    need_parking: values.need_parking,
    car_plate_number: values.need_parking ? values.car_plate_number || null : null,
    car_brand_model: values.need_parking ? values.car_brand_model || null : null,
    car_color: values.need_parking ? values.car_color || null : null,
    has_pets: values.has_pets,
    pet_name: values.has_pets ? values.pet_name || null : null,
    pet_type: values.has_pets ? values.pet_type || null : null,
    pet_breed: values.has_pets ? values.pet_breed || null : null,
    pet_age: values.has_pets ? values.pet_age || null : null,
    pet_vaccination_date: values.has_pets ? values.pet_vaccination_date || null : null,
    find_us: values.find_us || null,
    find_us_details: values.find_us_details || null,
    guest_special_requests: values.guest_special_requests || null,
    guest_requests_surprise_decor: values.guest_requests_surprise_decor,
  };
}

function toTimeInputValue(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  // Already HTML time input compatible.
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  // DB values may include seconds.
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  // Legacy 12-hour format like "2:00 PM".
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return '';
  const hour12 = Number(m[1]);
  const minute = m[2];
  const ampm = m[3].toUpperCase();
  let hour24 = hour12 % 12;
  if (ampm === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

function bookingToEditFormValues(booking: BookingRow): FormValues {
  return {
    booking_source: normalizeBookingSource(booking.booking_source),
    guest_facebook_name: toStr(booking.guest_facebook_name),
    primary_guest_name: toStr(booking.primary_guest_name),
    guest_email: toStr(booking.guest_email),
    guest_phone_number: toStr(booking.guest_phone_number),
    guest_address: toStr(booking.guest_address),
    nationality: toStr(booking.nationality),
    primary_guest_age: toAge(booking.primary_guest_age),
    guest2_name: toStr(booking.guest2_name),
    guest2_age: toAge(booking.guest2_age),
    guest3_name: toStr(booking.guest3_name),
    guest3_age: toAge(booking.guest3_age),
    guest4_name: toStr(booking.guest4_name),
    guest4_age: toAge(booking.guest4_age),
    guest5_name: toStr(booking.guest5_name),
    guest5_age: toAge(booking.guest5_age),
    check_in_date: normalizeDateString(toStr(booking.check_in_date)),
    check_out_date: normalizeDateString(toStr(booking.check_out_date)),
    check_in_time: toTimeInputValue(booking.check_in_time),
    check_out_time: toTimeInputValue(booking.check_out_time),
    number_of_adults: booking.number_of_adults ?? 1,
    number_of_children: booking.number_of_children ?? 0,
    number_of_nights: booking.number_of_nights ?? 1,
    need_parking: booking.need_parking ?? false,
    car_plate_number: toStr(booking.car_plate_number),
    car_brand_model: toStr(booking.car_brand_model),
    car_color: toStr(booking.car_color),
    has_pets: booking.has_pets ?? false,
    pet_name: toStr(booking.pet_name),
    pet_type: toStr(booking.pet_type),
    pet_breed: toStr(booking.pet_breed),
    pet_age: toStr(booking.pet_age),
    pet_vaccination_date: normalizeDateString(toStr(booking.pet_vaccination_date)),
    find_us: toStr(booking.find_us),
    find_us_details: toStr(booking.find_us_details),
    guest_special_requests: toStr(booking.guest_special_requests),
    guest_requests_surprise_decor: !!booking.guest_requests_surprise_decor,
  };
}

export function BookingEditForm({
  booking,
  onClose,
  onSaved,
  onPreview,
  initialTab,
  allowedTabs = ['stay', 'guest', 'parking', 'pets'],
}: Props) {
  const guestEditRevertPipeline = shouldRevertGuestFieldEditsToPendingReview(booking.status);
  const updateMut = useUpdateBooking();
  const apiUrl = import.meta.env.VITE_API_URL;
  const orgContext = useOptionalOrgContext();
  const { data: appSettings } = useAppSettings();
  const documentRequirements =
    appSettings?.resolvedDocumentRequirements ?? DEFAULT_DOCUMENT_REQUIREMENTS;
  const editTabsRef = useRef<BookingEditTabsHandle>(null);
  const propertySearchParams = React.useMemo(() => {
    const params = new URLSearchParams();
    const slug = orgContext?.property.slug?.trim();
    if (slug) params.set('property', slug);
    return params;
  }, [orgContext?.property.slug]);
  const [bookedDates, setBookedDates] = useState<BookedDateRange[]>([]);
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<UpdateBookingPayload | null>(null);
  const [visibleAdditionalGuestCount, setVisibleAdditionalGuestCount] = useState(() =>
    getInitialVisibleAdditionalGuestCount(booking)
  );

  const savedSensitiveBaseline = React.useMemo(
    () => bookingEditPayloadFromValues(bookingToEditFormValues(booking)),
    [booking]
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    defaultValues: bookingToEditFormValues(booking),
  });

  /**
   * `useWatch` subscribes reliably; bare `watch()` here did not always re-render on edits.
   * Deliberately whole-form: `bookingEditPayloadFromValues`/the sensitive-field diff below
   * read nearly every field, so a narrower `name` list would have to be kept in exact sync
   * with that payload shape — the same class of drift as the `compareFormData` /
   * `petType` sharp edge already documented in CLAUDE.md. Kept broad on purpose.
   */
  const formSnapshot = useWatch({ control }) as FormValues;
  const watchParking = !!formSnapshot?.need_parking;
  const watchPets = !!formSnapshot?.has_pets;
  const watchSurpriseDecor = !!formSnapshot?.guest_requests_surprise_decor;
  const surpriseDecorChangedFromSaved =
    watchSurpriseDecor !== !!booking.guest_requests_surprise_decor;
  const showSensitiveRevertHint =
    guestEditRevertPipeline &&
    isDirty &&
    hasWorkflowSensitiveGuestFieldDiff(
      savedSensitiveBaseline,
      bookingEditPayloadFromValues(formSnapshot),
      documentRequirements
    );
  const canSave = isDirty;

  React.useEffect(() => {
    let mounted = true;
    const fetchBookedDates = async () => {
      try {
        const response = await fetch(
          guestBookedDatesUrl(apiUrl, orgContext?.property.slug ?? null, propertySearchParams),
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const result = await response.json();
        if (!mounted || !response.ok || !result?.success || !result?.data) return;
        const normalized = result.data.map((entry: BookedDateRange) => ({
          ...entry,
          checkInDate: normalizeDateString(entry.checkInDate),
          checkOutDate: normalizeDateString(entry.checkOutDate),
        }));
        setBookedDates(normalized);
      } catch (error) {
        console.error('Failed to fetch booked dates for admin edit form:', error);
      }
    };
    void fetchBookedDates();
    return () => {
      mounted = false;
    };
  }, [apiUrl, propertySearchParams]);

  React.useEffect(() => {
    const checkIn = formSnapshot?.check_in_date?.trim();
    const checkOut = formSnapshot?.check_out_date?.trim();
    if (!checkIn || !checkOut) return;
    const nights = countParkingNights(checkIn, checkOut);
    setValue('number_of_nights', nights, { shouldDirty: false });
  }, [formSnapshot?.check_in_date, formSnapshot?.check_out_date, setValue]);

  React.useEffect(() => {
    const counts = computeGuestCounts([
      {
        name: formSnapshot?.primary_guest_name,
        age: formSnapshot?.primary_guest_age === '' ? undefined : formSnapshot?.primary_guest_age,
      },
      {
        name: formSnapshot?.guest2_name,
        age: formSnapshot?.guest2_age === '' ? undefined : formSnapshot?.guest2_age,
      },
      {
        name: formSnapshot?.guest3_name,
        age: formSnapshot?.guest3_age === '' ? undefined : formSnapshot?.guest3_age,
      },
      {
        name: formSnapshot?.guest4_name,
        age: formSnapshot?.guest4_age === '' ? undefined : formSnapshot?.guest4_age,
      },
      {
        name: formSnapshot?.guest5_name,
        age: formSnapshot?.guest5_age === '' ? undefined : formSnapshot?.guest5_age,
      },
    ]);
    setValue('number_of_adults', counts.adults, { shouldDirty: false });
    setValue('number_of_children', counts.children, { shouldDirty: false });
  }, [
    formSnapshot?.primary_guest_name,
    formSnapshot?.primary_guest_age,
    formSnapshot?.guest2_name,
    formSnapshot?.guest2_age,
    formSnapshot?.guest3_name,
    formSnapshot?.guest3_age,
    formSnapshot?.guest4_name,
    formSnapshot?.guest4_age,
    formSnapshot?.guest5_name,
    formSnapshot?.guest5_age,
    setValue,
  ]);

  const adminPartySize = Math.max(
    getActivePartySize([
      {
        name: formSnapshot?.primary_guest_name,
        age: formSnapshot?.primary_guest_age === '' ? undefined : formSnapshot?.primary_guest_age,
      },
      {
        name: formSnapshot?.guest2_name,
        age: formSnapshot?.guest2_age === '' ? undefined : formSnapshot?.guest2_age,
      },
      {
        name: formSnapshot?.guest3_name,
        age: formSnapshot?.guest3_age === '' ? undefined : formSnapshot?.guest3_age,
      },
      {
        name: formSnapshot?.guest4_name,
        age: formSnapshot?.guest4_age === '' ? undefined : formSnapshot?.guest4_age,
      },
      {
        name: formSnapshot?.guest5_name,
        age: formSnapshot?.guest5_age === '' ? undefined : formSnapshot?.guest5_age,
      },
    ]),
    1 + visibleAdditionalGuestCount
  );

  const visibleAdditionalGuestSlots = ADDITIONAL_GUEST_SLOTS.slice(0, visibleAdditionalGuestCount);

  const handleAddAdditionalGuest = () => {
    setVisibleAdditionalGuestCount((count) => {
      const next = Math.min(MAX_GUESTS - 1, count + 1);
      const slot = ADDITIONAL_GUEST_SLOTS[next - 1];
      const currentAge = formSnapshot[slot.ageField];
      if (currentAge === '' || currentAge == null) {
        setValue(slot.ageField, getDefaultAgeForPartyGuest(slot.partyPosition, 1 + next), {
          shouldDirty: true,
        });
      }
      return next;
    });
  };

  const handleRemoveAdditionalGuest = (slot: AdditionalGuestSlotConfig) => {
    setValue(slot.nameField, '', { shouldDirty: true });
    setValue(slot.ageField, '', { shouldDirty: true });
    setVisibleAdditionalGuestCount((count) => Math.max(0, count - 1));
  };

  const onInvalid: SubmitErrorHandler<FormValues> = (fieldErrors) => {
    toast.error('Fix the highlighted fields');
    editTabsRef.current?.focusFirstError(fieldErrors as FieldErrors<FormValues>);
  };

  const buildPayloadFromValues = (values: FormValues): UpdateBookingPayload => {
    const payload: UpdateBookingPayload = {
      ...bookingEditPayloadFromValues(values),
    };

    const newSource = normalizeBookingSource(values.booking_source);
    const wasAirbnb = normalizeBookingSource(booking.booking_source) === 'Airbnb';
    const isNowAirbnb = newSource === 'Airbnb';
    if (isNowAirbnb) {
      payload.down_payment = 0;
      payload.security_deposit = 0;
      const rate =
        payload.booking_rate ??
        (booking.booking_rate != null ? Number(booking.booking_rate) : null);
      if (rate != null && !Number.isNaN(rate)) {
        payload.balance = Math.round(rate * 100) / 100;
      }
    }
    if (isNowAirbnb && !wasAirbnb) {
      payload.guest_balance_paid_amount = null;
      payload.guest_balance_payment_receipt_url = null;
      payload.balance_receipt_ai_verdict = null;
      payload.balance_receipt_ai_summary = null;
    }

    return payload;
  };

  const persistBooking = async (payload: UpdateBookingPayload, revertToPendingReview: boolean) => {
    const updated = await updateMut.mutateAsync({
      bookingId: booking.id,
      currentStatus: booking.status,
      payload,
      revertToPendingReview,
      revertBaselinePayload: savedSensitiveBaseline,
      currentDocumentRequirementCompletions: (
        booking as { document_requirement_completions?: unknown }
      ).document_requirement_completions,
    });

    captureAppEvent('booking_updated', {
      reverted_to_pending_review: revertToPendingReview,
      booking_source: payload.booking_source ?? 'unknown',
      needs_parking: Boolean(payload.need_parking),
      has_pets: Boolean(payload.has_pets),
    });

    if (revertToPendingReview) {
      toast.success('Booking updated. Moved to Pending Review');
    } else {
      toast.success('Booking updated');
    }

    setSaveChoiceOpen(false);
    setPendingPayload(null);
    onSaved(updated);
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payload = buildPayloadFromValues(values);
    const needsSaveChoice =
      guestEditRevertPipeline &&
      hasWorkflowSensitiveGuestFieldDiff(savedSensitiveBaseline, payload, documentRequirements);

    if (needsSaveChoice) {
      setPendingPayload(payload);
      setSaveChoiceOpen(true);
      return;
    }

    try {
      await persistBooking(payload, false);
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save booking'));
    }
  };

  const handleSaveChoice = async (revertToPendingReview: boolean) => {
    if (!pendingPayload) return;
    try {
      await persistBooking(pendingPayload, revertToPendingReview);
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save booking'));
    }
  };

  const saveLabel = 'Save';
  const formId = `booking-edit-form-${booking.id}`;

  return (
    <>
      <form id={formId} onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <BookingEditTabs
          ref={editTabsRef}
          booking={booking}
          allowedTabs={allowedTabs}
          actions={{
            onCancel: onClose,
            cancelDisabled: updateMut.isPending,
            saveDisabled: updateMut.isPending || !canSave,
            savePending: updateMut.isPending,
            saveLabel,
            formId,
          }}
          errors={errors}
          sensitiveNoticeVisible={showSensitiveRevertHint}
          initialTab={initialTab}
          tabs={{
            ...(allowedTabs.includes('guest')
              ? {
                  guest: (
                    <GuestIdentityTab
                      booking={booking}
                      register={register}
                      errors={errors}
                      setValue={setValue}
                      onPreview={onPreview}
                      formSnapshot={formSnapshot}
                      adminPartySize={adminPartySize}
                      visibleAdditionalGuestCount={visibleAdditionalGuestCount}
                      visibleAdditionalGuestSlots={visibleAdditionalGuestSlots}
                      onAddAdditionalGuest={handleAddAdditionalGuest}
                      onRemoveAdditionalGuest={handleRemoveAdditionalGuest}
                      surpriseDecorChangedFromSaved={surpriseDecorChangedFromSaved}
                    />
                  ),
                }
              : {}),
            ...(allowedTabs.includes('stay')
              ? {
                  stay: (
                    <StayDetailsTab
                      booking={booking}
                      register={register}
                      errors={errors}
                      setValue={setValue}
                      formSnapshot={formSnapshot}
                      bookedDates={bookedDates}
                      onPreview={onPreview}
                    />
                  ),
                }
              : {}),
            ...(allowedTabs.includes('parking')
              ? {
                  parking: (
                    <ParkingTab
                      register={register}
                      setValue={setValue}
                      watchParking={watchParking}
                    />
                  ),
                }
              : {}),
            ...(allowedTabs.includes('pets')
              ? {
                  pets: (
                    <PetsTab
                      booking={booking}
                      register={register}
                      setValue={setValue}
                      watchPets={watchPets}
                      petVaccinationDate={formSnapshot?.pet_vaccination_date ?? ''}
                      onPreview={onPreview}
                    />
                  ),
                }
              : {}),
          }}
          footer={
            <BookingEditStickyBar
              onCancel={onClose}
              cancelDisabled={updateMut.isPending}
              saveDisabled={updateMut.isPending || !canSave}
              savePending={updateMut.isPending}
              saveLabel={saveLabel}
              formId={formId}
            />
          }
        />
      </form>

      <BookingEditSaveChoiceDialog
        open={saveChoiceOpen}
        onOpenChange={setSaveChoiceOpen}
        isSaving={updateMut.isPending}
        onSaveOnly={() => void handleSaveChoice(false)}
        onSaveAndRevert={() => void handleSaveChoice(true)}
      />
    </>
  );
}
