import { Car, CalendarDays, User } from 'lucide-react';

import type {
  GuestFormStepConfig,
  GuestFormStepId,
} from '@/features/guest/form/lib/guestFormSteps';
import type { ParkingRegistrationValues } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';
import { parkingRegistrationSchema } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';

export const PARKING_REGISTRATION_STEPS: GuestFormStepConfig[] = [
  {
    id: 1,
    title: 'Guest',
    hint: 'Your contact details',
    icon: User,
  },
  {
    id: 2,
    title: 'Booking',
    hint: 'Unit and parking dates',
    icon: CalendarDays,
  },
  {
    id: 3,
    title: 'Vehicle',
    hint: 'For building security',
    icon: Car,
  },
];

export const PARKING_REGISTRATION_STEP_COUNT = PARKING_REGISTRATION_STEPS.length;

export function getFieldsForParkingStep(
  step: GuestFormStepId
): (keyof ParkingRegistrationValues)[] {
  switch (step) {
    case 1:
      return ['guestName', 'email', 'phone'];
    case 2:
      return ['unitNumber', 'checkInDate', 'checkOutDate'];
    case 3:
      return ['vehicleType', 'carPlateNumber', 'carBrandModel', 'carColor', 'notes'];
    default:
      return [];
  }
}

/** True when every field for this step passes the schema (ignores errors that belong to other steps). */
export function isParkingStepComplete(
  step: GuestFormStepId,
  values: ParkingRegistrationValues
): boolean {
  const stepFields = new Set(getFieldsForParkingStep(step));
  const result = parkingRegistrationSchema.safeParse(values);
  if (result.success) return true;

  return !result.error.issues.some((issue) => {
    const key = issue.path[0];
    return typeof key === 'string' && stepFields.has(key as keyof ParkingRegistrationValues);
  });
}

export function clampParkingStep(step: number): GuestFormStepId {
  return Math.min(PARKING_REGISTRATION_STEP_COUNT, Math.max(1, step)) as GuestFormStepId;
}
