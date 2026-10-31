import { CalendarRange } from 'lucide-react';

import { normalizeBookingSource } from '@/features/guest/form/lib/bookingSourceFromSearchParams';

import {
  Field,
  fieldErrorMessage,
  Input,
  Row2,
  Row3,
  Section,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditFields';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import type { BookingEditFormValues } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { bookingEditDatePickerClass } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { BookingGuestDocReplacer } from '@/features/dashboard/bookings/components/BookingGuestDocReplacer';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { DatePicker } from '@/components/ui/date-picker';
import {
  createDisabledCheckoutDateMatcher,
  createDisabledDateMatcher,
  dateToString,
  getNextDay,
  stringToDate,
  DATE_PICKER_DISPLAY_FORMAT,
  type BookedDateRange,
} from '@/utils/format/dates';

import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';

type Props = {
  booking: BookingRow;
  register: UseFormRegister<BookingEditFormValues>;
  errors: FieldErrors<BookingEditFormValues>;
  setValue: UseFormSetValue<BookingEditFormValues>;
  formSnapshot: BookingEditFormValues;
  bookedDates: BookedDateRange[];
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
};

export function StayDetailsTab({
  booking,
  register,
  errors,
  setValue,
  formSnapshot,
  bookedDates,
  onPreview,
}: Props) {
  const watchCheckInDate = formSnapshot?.check_in_date ?? '';
  const isAirbnb =
    normalizeBookingSource(formSnapshot?.booking_source ?? booking.booking_source) === 'Airbnb';

  return (
    <BookingDetailCard title="Stay details" icon={CalendarRange} tone="edit">
      <input type="hidden" {...register('check_in_date', { required: 'Check-in is required' })} />
      <input type="hidden" {...register('check_out_date', { required: 'Check-out is required' })} />

      <div className="space-y-4">
        <Section title="Dates">
          <Row2>
            <Field
              label="Check-in"
              required
              fieldKey="check_in_date"
              error={fieldErrorMessage(errors.check_in_date)}
            >
              <DatePicker
                date={watchCheckInDate ? stringToDate(watchCheckInDate) : undefined}
                rangeEnd={
                  formSnapshot.check_out_date
                    ? stringToDate(formSnapshot.check_out_date)
                    : undefined
                }
                onSelect={(date) => {
                  if (!date) return;
                  const selected = dateToString(date);
                  setValue('check_in_date', selected, { shouldDirty: true, shouldValidate: true });
                  setValue('check_out_date', getNextDay(selected), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (date < today) return true;
                  return createDisabledDateMatcher(bookedDates, booking.id)(date);
                }}
                minDate={new Date()}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                className={bookingEditDatePickerClass}
              />
            </Field>
            <Field
              label="Check-out"
              required
              fieldKey="check_out_date"
              error={fieldErrorMessage(errors.check_out_date)}
            >
              <DatePicker
                date={
                  formSnapshot.check_out_date
                    ? stringToDate(formSnapshot.check_out_date)
                    : undefined
                }
                rangeEnd={watchCheckInDate ? stringToDate(watchCheckInDate) : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  setValue('check_out_date', dateToString(date), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                disabled={(date) => {
                  const isBooked = createDisabledCheckoutDateMatcher(bookedDates, booking.id)(date);
                  if (watchCheckInDate) {
                    const checkIn = stringToDate(watchCheckInDate);
                    if (date <= checkIn) return true;
                  }
                  return isBooked;
                }}
                minDate={watchCheckInDate ? stringToDate(getNextDay(watchCheckInDate)) : new Date()}
                placeholder={DATE_PICKER_DISPLAY_FORMAT}
                className={bookingEditDatePickerClass}
              />
            </Field>
          </Row2>
          <Row2>
            <Field label="Check-in time" htmlFor="check_in_time">
              <Input
                id="check_in_time"
                type="time"
                {...register('check_in_time')}
                placeholder="14:00"
              />
            </Field>
            <Field label="Check-out time" htmlFor="check_out_time">
              <Input
                id="check_out_time"
                type="time"
                {...register('check_out_time')}
                placeholder="11:00"
              />
            </Field>
          </Row2>
        </Section>

        <Section title="Party size">
          <Row3>
            <Field label="Adults" required htmlFor="number_of_adults">
              <Input
                id="number_of_adults"
                type="number"
                min={1}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="bg-muted/40 pointer-events-none tabular-nums"
                {...register('number_of_adults', { required: true, valueAsNumber: true })}
              />
            </Field>
            <Field label="Children" htmlFor="number_of_children">
              <Input
                id="number_of_children"
                type="number"
                min={0}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="bg-muted/40 pointer-events-none tabular-nums"
                {...register('number_of_children', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Nights" required htmlFor="number_of_nights">
              <Input
                id="number_of_nights"
                type="number"
                min={1}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="bg-muted/40 pointer-events-none tabular-nums"
                {...register('number_of_nights', { required: true, valueAsNumber: true })}
              />
            </Field>
          </Row3>
        </Section>

        {!isAirbnb ? (
          <Section title="Payment">
            <BookingGuestDocReplacer
              bookingId={booking.id}
              assetType="payment_receipt"
              label="Downpayment receipt"
              currentUrl={booking.payment_receipt_url}
              accept="image/*,.pdf"
              onPreview={onPreview}
            />
          </Section>
        ) : null}
      </div>
    </BookingDetailCard>
  );
}
