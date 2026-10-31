/** Azure North parking towers — keep in sync with ui/.../parkingResidences.ts */

export const DEFAULT_PARKING_RESIDENCE_NAME = 'Azure North Residences';

export const AZURE_NORTH_PARKING_TOWERS = ['Monaco', 'Bali', 'Barbados', 'Bay'] as const;
export type AzureNorthParkingTower = (typeof AZURE_NORTH_PARKING_TOWERS)[number];

export const AZURE_NORTH_PARKING_LEVELS = ['Level 1', 'Level 2', 'Level 3'] as const;
export type AzureNorthParkingLevel = (typeof AZURE_NORTH_PARKING_LEVELS)[number];

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

export const PARKING_TYPES = ['inside_tower', 'outside_tower', 'motorcycle'] as const;
export type ParkingType = (typeof PARKING_TYPES)[number];

export function isAzureNorthParkingTower(value: string): value is AzureNorthParkingTower {
  return (AZURE_NORTH_PARKING_TOWERS as readonly string[]).includes(value);
}

export function isAzureNorthParkingLevel(value: string): value is AzureNorthParkingLevel {
  return (AZURE_NORTH_PARKING_LEVELS as readonly string[]).includes(value);
}

export function isParkingType(value: string): value is ParkingType {
  return (PARKING_TYPES as readonly string[]).includes(value);
}

export function sanitizeParkingSlotNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function isValidParkingSlotNumber(value: string): boolean {
  return /^\d{1,4}$/.test(value.trim());
}

/** Display name shown in admin + guest surfaces, e.g. Monaco - Level 1 - Slot 26 */
export function formatParkingDisplayName(tower: string, level: string, slotNumber: string): string {
  const towerTrim = tower.trim();
  const levelTrim = normalizeParkingLevel(level);
  const slot = sanitizeParkingSlotNumber(slotNumber);
  if (!towerTrim || !levelTrim || !slot) return '';
  return `${towerTrim} - ${levelTrim} - Slot ${slot}`;
}

const PARKING_TOWER_CODES: Record<string, string> = {
  Monaco: 'M',
  Bali: 'BL',
  Barbados: 'BB',
  Bay: 'BY',
};

function parkingLevelShortCode(level: string): string {
  const match = normalizeParkingLevel(level).match(/^Level\s+(\d+)$/i);
  return match ? `L${match[1]}` : '';
}

/** Compact code for narrow UI, e.g. ML1S26 */
export function formatParkingCode(tower: string, level: string, slotNumber: string): string {
  const towerCode = PARKING_TOWER_CODES[tower.trim()] ?? '';
  const levelCode = parkingLevelShortCode(level);
  const slot = sanitizeParkingSlotNumber(slotNumber);
  if (!towerCode || !levelCode || !slot) return '';
  return `${towerCode}${levelCode}S${slot}`;
}

export function inferParkingTypeForTower(tower: string): ParkingType {
  return tower === 'Bay' ? 'outside_tower' : 'inside_tower';
}
