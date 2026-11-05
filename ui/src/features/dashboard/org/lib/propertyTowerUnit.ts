import {
  ALL_PROPERTY_TOWERS,
  isTowerInResidence,
} from '@/features/dashboard/org/lib/propertyResidences';

export { isTowerInResidence } from '@/features/dashboard/org/lib/propertyResidences';

export const PROPERTY_TOWERS = ALL_PROPERTY_TOWERS;
export type PropertyTower = (typeof ALL_PROPERTY_TOWERS)[number];

export function isPropertyTower(value: string): value is PropertyTower {
  return (ALL_PROPERTY_TOWERS as readonly string[]).includes(value);
}

export function isPropertyTowerForResidence(tower: string, residenceName: string): boolean {
  if (residenceName.trim()) {
    return isTowerInResidence(tower, residenceName);
  }
  return isPropertyTower(tower);
}

export function isValidUnitNumber(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

export function formatTowerAndUnit(tower: string, unitNumber: string): string {
  return `${tower} ${unitNumber.trim()}`;
}

/** Parse legacy `tower_and_unit` text into structured tower + unit when columns are empty. */
export function parseTowerAndUnitFromLegacy(
  towerAndUnit: string
): { tower: PropertyTower; unitNumber: string } | null {
  const trimmed = towerAndUnit.trim();
  if (!trimmed) return null;
  for (const towerName of ALL_PROPERTY_TOWERS) {
    const match = trimmed.match(new RegExp(`^${towerName}\\s+(\\d{4})$`, 'i'));
    if (match) {
      return { tower: towerName, unitNumber: match[1] };
    }
  }
  return null;
}

export function sanitizeUnitNumberInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}
