import { z } from 'zod';

import { requiredPhilippineMobilePhoneZodSchema } from '@/lib/validation/fieldValidation';

export const parkingVehicleTypeOptions = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
] as const;

export const parkingRegistrationSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Guest name is required'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    phone: requiredPhilippineMobilePhoneZodSchema(),
    unitNumber: z.string().trim().min(1, 'Unit number is required'),
    checkInDate: z.string().min(1, 'Please select a check-in date'),
    checkOutDate: z.string().min(1, 'Please select a check-out date'),
    vehicleType: z.enum(['car', 'motorcycle'], {
      errorMap: () => ({ message: 'Please select a vehicle type' }),
    }),
    carPlateNumber: z
      .string()
      .trim()
      .min(1, 'Plate number is required')
      .transform((v) => v.toUpperCase()),
    carBrandModel: z.string().trim().min(1, 'Brand/model is required'),
    carColor: z.string().trim().min(1, 'Color is required'),
    notes: z.string().trim().optional().default(''),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

export type ParkingRegistrationValues = z.infer<typeof parkingRegistrationSchema>;
