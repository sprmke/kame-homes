/** Azure North parking constants — keep in sync with supabase/functions/_shared/parkingResidences.ts */

export const DEFAULT_PARKING_RESIDENCE_NAME = 'Azure North Residences';

export const AZURE_NORTH_PARKING_TOWERS = ['Monaco', 'Bali', 'Barbados', 'Bay'] as const;
export type AzureNorthParkingTower = (typeof AZURE_NORTH_PARKING_TOWERS)[number];

export const DEFAULT_PARKING_TOWER: AzureNorthParkingTower = 'Monaco';

export const AZURE_NORTH_PARKING_LEVELS = ['Level 1', 'Level 2', 'Level 3'] as const;
export type AzureNorthParkingLevel = (typeof AZURE_NORTH_PARKING_LEVELS)[number];

export const DEFAULT_PARKING_LEVEL: AzureNorthParkingLevel = 'Level 1';

/** Bay promenade parking is ground-level only */
export const AZURE_NORTH_BAY_PARKING_LEVELS = ['Level 1'] as const;

const LEGACY_PARKING_LEVEL_MAP: Record<string, AzureNorthParkingLevel> = {
  Ground: 'Level 1',
  '2nd Floor': 'Level 2',
  '3rd Floor': 'Level 3',
};

export function normalizeParkingLevel(level: string): string {
  const trimmed = level.trim();
  return LEGACY_PARKING_LEVEL_MAP[trimmed] ?? trimmed;
}

export function getParkingLevelsForTower(tower: string): readonly string[] {
  if (tower === 'Bay') return AZURE_NORTH_BAY_PARKING_LEVELS;
  if (isAzureNorthParkingTower(tower) && tower !== 'Bay') return AZURE_NORTH_PARKING_LEVELS;
  return [];
}

export function isValidParkingLevelForTower(tower: string, level: string): boolean {
  return getParkingLevelsForTower(tower).includes(level);
}

export const PARKING_TYPES = [
  { value: 'inside_tower' as const, label: 'Inside tower' },
  { value: 'outside_tower' as const, label: 'Outside tower' },
  { value: 'motorcycle' as const, label: 'Motorcycle' },
];

export type ParkingType = (typeof PARKING_TYPES)[number]['value'];

export function isAzureNorthParkingTower(value: string): value is AzureNorthParkingTower {
  return (AZURE_NORTH_PARKING_TOWERS as readonly string[]).includes(value);
}

export function isAzureNorthParkingLevel(value: string): value is AzureNorthParkingLevel {
  return (AZURE_NORTH_PARKING_LEVELS as readonly string[]).includes(value);
}

/** Residence / development names for parking slot settings. */
export function getParkingResidenceNames(): string[] {
  return [DEFAULT_PARKING_RESIDENCE_NAME];
}
