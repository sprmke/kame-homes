import type { ParkingType } from '@/features/dashboard/org/lib/parkingResidences';
import { normalizeParkingLevel } from '@/features/dashboard/org/lib/parkingResidences';

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

type ParkingCompactLabelFields = {
  tower?: string | null;
  level?: string | null;
  slotLabel?: string | null;
  name?: string;
};

/** Compact label for switchers; falls back to stored name when slot fields are incomplete. */
export function resolveParkingCompactLabel(parking: ParkingCompactLabelFields): string {
  const code = formatParkingCode(parking.tower ?? '', parking.level ?? '', parking.slotLabel ?? '');
  return code || parking.name?.trim() || '';
}

export function inferParkingTypeForTower(tower: string): ParkingType {
  return tower === 'Bay' ? 'outside_tower' : 'inside_tower';
}

/** Best-effort numeric slot for legacy labels like M-B1-001 */
export function parseParkingSlotNumberFromLabel(slotLabel: string): string {
  const trimmed = slotLabel.trim();
  if (/^\d{1,4}$/.test(trimmed)) return trimmed;
  const trailingDigits = trimmed.match(/(\d{1,4})$/);
  return trailingDigits?.[1] ?? '';
}
