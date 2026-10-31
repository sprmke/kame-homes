import { PawPrint } from 'lucide-react';

import {
  CheckboxOption,
  Field,
  Input,
  Row2,
  Row3,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditFields';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import type { BookingEditFormValues } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { bookingEditDatePickerClass } from '@/features/dashboard/bookings/components/bookingEditFormShared';
import { BookingGuestDocReplacer } from '@/features/dashboard/bookings/components/BookingGuestDocReplacer';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { DatePicker } from '@/components/ui/date-picker';
import { dateToString, stringToDate, DATE_PICKER_DISPLAY_FORMAT } from '@/utils/format/dates';

import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';

type Props = {
  booking: BookingRow;
  register: UseFormRegister<BookingEditFormValues>;
  setValue: UseFormSetValue<BookingEditFormValues>;
  watchPets: boolean;
  petVaccinationDate: string;
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
};

export function PetsTab({
  booking,
  register,
  setValue,
  watchPets,
  petVaccinationDate,
  onPreview,
}: Props) {
  return (
    <BookingDetailCard title="Pet information" icon={PawPrint} tone="edit">
      <div className="space-y-3.5 sm:space-y-4">
        <CheckboxOption
          id="has_pets"
          label="Has pets"
          checked={watchPets}
          onCheckedChange={(value) =>
            setValue('has_pets', value, { shouldDirty: true, shouldValidate: true })
          }
        />
        {watchPets ? (
          <>
            <Row2>
              <Field label="Pet name" htmlFor="pet_name">
                <Input id="pet_name" {...register('pet_name')} autoComplete="off" />
              </Field>
              <Field label="Type" htmlFor="pet_type">
                <Input
                  id="pet_type"
                  {...register('pet_type')}
                  placeholder="Dog / Cat"
                  autoComplete="off"
                />
              </Field>
            </Row2>
            <Row3>
              <Field label="Breed" htmlFor="pet_breed">
                <Input id="pet_breed" {...register('pet_breed')} autoComplete="off" />
              </Field>
              <Field label="Age" htmlFor="pet_age">
                <Input
                  id="pet_age"
                  {...register('pet_age')}
                  placeholder="2 years"
                  autoComplete="off"
                />
              </Field>
              <Field label="Vaccination date" fieldKey="pet_vaccination_date">
                <DatePicker
                  date={petVaccinationDate ? stringToDate(petVaccinationDate) : undefined}
                  onSelect={(date) => {
                    setValue('pet_vaccination_date', date ? dateToString(date) : '', {
                      shouldDirty: true,
                    });
                  }}
                  placeholder={DATE_PICKER_DISPLAY_FORMAT}
                  className={bookingEditDatePickerClass}
                />
              </Field>
            </Row3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BookingGuestDocReplacer
                bookingId={booking.id}
                assetType="pet_vaccination"
                label="Vaccination record"
                currentUrl={booking.pet_vaccination_url}
                accept="image/*,.pdf"
                onPreview={onPreview}
              />
              <BookingGuestDocReplacer
                bookingId={booking.id}
                assetType="pet_image"
                label="Pet photo"
                currentUrl={booking.pet_image_url}
                accept="image/*"
                onPreview={onPreview}
              />
            </div>
          </>
        ) : null}
      </div>
    </BookingDetailCard>
  );
}
