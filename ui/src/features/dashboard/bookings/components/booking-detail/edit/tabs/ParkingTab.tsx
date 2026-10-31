import { Car } from 'lucide-react';

import {
  CheckboxOption,
  Field,
  Input,
  Row3,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditFields';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import type { BookingEditFormValues } from '@/features/dashboard/bookings/components/bookingEditFormShared';

import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';

type Props = {
  register: UseFormRegister<BookingEditFormValues>;
  setValue: UseFormSetValue<BookingEditFormValues>;
  watchParking: boolean;
};

export function ParkingTab({ register, setValue, watchParking }: Props) {
  return (
    <BookingDetailCard title="Parking" icon={Car} tone="edit">
      <div className="space-y-3.5 sm:space-y-4">
        <CheckboxOption
          id="need_parking"
          label="Needs parking"
          checked={watchParking}
          onCheckedChange={(value) =>
            setValue('need_parking', value, { shouldDirty: true, shouldValidate: true })
          }
        />
        {watchParking ? (
          <Row3>
            <Field label="Plate number" htmlFor="car_plate_number">
              <Input
                id="car_plate_number"
                {...register('car_plate_number')}
                placeholder="ABC 123"
                autoComplete="off"
              />
            </Field>
            <Field label="Brand / model" htmlFor="car_brand_model">
              <Input
                id="car_brand_model"
                {...register('car_brand_model')}
                placeholder="Toyota Vios"
                autoComplete="off"
              />
            </Field>
            <Field label="Color" htmlFor="car_color">
              <Input
                id="car_color"
                {...register('car_color')}
                placeholder="White"
                autoComplete="off"
              />
            </Field>
          </Row3>
        ) : null}
      </div>
    </BookingDetailCard>
  );
}
