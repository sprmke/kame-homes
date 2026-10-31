import { z } from 'zod';

export const payParkingVehicleSchema = z.object({
  carPlateNumber: z
    .string()
    .trim()
    .min(1, 'Car plate number is required')
    .transform((v) => v.toUpperCase()),
  carBrandModel: z.string().trim().min(1, 'Car brand and model is required'),
  carColor: z.string().trim().min(1, 'Car color is required'),
});

export type PayParkingVehicleValues = z.infer<typeof payParkingVehicleSchema>;
