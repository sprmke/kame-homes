/** Default parking space dimensions (meters) when unset in `parkings.settings`. */
export const DEFAULT_PARKING_SPACE_LENGTH_M = 5;
export const DEFAULT_PARKING_SPACE_WIDTH_M = 2.5;
export const DEFAULT_PARKING_HEIGHT_CLEARANCE_M = 2.1;

export function resolveParkingSpaceLengthM(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return DEFAULT_PARKING_SPACE_LENGTH_M;
}

export function resolveParkingSpaceWidthM(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return DEFAULT_PARKING_SPACE_WIDTH_M;
}

export function resolveParkingHeightClearanceM(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return DEFAULT_PARKING_HEIGHT_CLEARANCE_M;
}

function readStoredDimension(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function readParkingSpaceLengthM(settings: Record<string, unknown>): number {
  return resolveParkingSpaceLengthM(readStoredDimension(settings, 'spaceLengthM'));
}

export function readParkingSpaceWidthM(settings: Record<string, unknown>): number {
  return resolveParkingSpaceWidthM(readStoredDimension(settings, 'spaceWidthM'));
}

export function readParkingHeightClearanceM(settings: Record<string, unknown>): number {
  return resolveParkingHeightClearanceM(readStoredDimension(settings, 'heightClearanceM'));
}

/** Car-size fit tiers, largest to smallest. Thresholds are cumulative — meeting a
 * larger tier's minimums always meets every smaller tier's minimums too. */
export type CarSizeTier = 'compact' | 'sedan' | 'suv' | 'van';

export const VEHICLE_FIT_TIER_THRESHOLDS: Record<
  CarSizeTier,
  { minLengthM: number; minWidthM: number; minHeightClearanceM: number }
> = {
  compact: { minLengthM: 4.0, minWidthM: 1.8, minHeightClearanceM: 1.6 },
  sedan: { minLengthM: 4.5, minWidthM: 2.0, minHeightClearanceM: 1.8 },
  suv: { minLengthM: 5.0, minWidthM: 2.2, minHeightClearanceM: 2.0 },
  van: { minLengthM: 5.5, minWidthM: 2.3, minHeightClearanceM: 2.2 },
};

const CAR_TIERS_LARGEST_FIRST: CarSizeTier[] = ['van', 'suv', 'sedan', 'compact'];

export function resolveVehicleFit(input: {
  spaceLengthM: number;
  spaceWidthM: number;
  heightClearanceM: number;
  acceptedVehicleTypes: ReadonlyArray<'car' | 'motorcycle'>;
}): { carTiers: CarSizeTier[]; acceptsMotorcycle: boolean } {
  const acceptsMotorcycle = input.acceptedVehicleTypes.includes('motorcycle');
  if (!input.acceptedVehicleTypes.includes('car')) {
    return { carTiers: [], acceptsMotorcycle };
  }

  const highestFitIndex = CAR_TIERS_LARGEST_FIRST.findIndex((tier) => {
    const t = VEHICLE_FIT_TIER_THRESHOLDS[tier];
    return (
      input.spaceLengthM >= t.minLengthM &&
      input.spaceWidthM >= t.minWidthM &&
      input.heightClearanceM >= t.minHeightClearanceM
    );
  });

  const carTiers = highestFitIndex === -1 ? [] : CAR_TIERS_LARGEST_FIRST.slice(highestFitIndex);
  return { carTiers, acceptsMotorcycle };
}

const VALID_VEHICLE_TYPES = ['car', 'motorcycle'] as const;
export type ParkingVehicleType = (typeof VALID_VEHICLE_TYPES)[number];

/** Validates `acceptedVehicleTypes` from a request body: non-empty subset of {car, motorcycle}. */
export function parseAcceptedVehicleTypes(
  value: unknown
): { ok: true; value: ParkingVehicleType[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'acceptedVehicleTypes must be a non-empty array' };
  }
  const deduped = Array.from(new Set(value));
  const invalid = deduped.some(
    (v) => typeof v !== 'string' || !VALID_VEHICLE_TYPES.includes(v as ParkingVehicleType)
  );
  if (invalid) {
    return { ok: false, error: 'acceptedVehicleTypes must only contain car or motorcycle' };
  }
  return { ok: true, value: deduped as ParkingVehicleType[] };
}
