import {
  formatTowerAndUnit,
  isPropertyTowerForResidence,
  isValidUnitNumber,
} from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { Property } from '@/features/dashboard/org/types';

export type PropertyTowerUnitConflict = {
  property: Property;
  orgName: string;
  orgSlug: string;
};

export function propertyMatchesTowerUnit(
  property: Property,
  tower: string,
  unitNumber: string
): boolean {
  if (property.tower && property.unitNumber) {
    return (
      property.tower.toLowerCase() === tower.toLowerCase() && property.unitNumber === unitNumber
    );
  }

  const formatted = formatTowerAndUnit(tower, unitNumber);
  return property.towerAndUnit?.trim() === formatted;
}

export function findPropertyTowerUnitConflict(
  properties: Array<Property & { orgName: string; orgSlug: string }>,
  tower: string,
  unitNumber: string,
  excludePropertyId?: string
): PropertyTowerUnitConflict | null {
  if (!isPropertyTowerForResidence(tower, '') || !isValidUnitNumber(unitNumber)) return null;

  for (const row of properties) {
    if (excludePropertyId && row.id === excludePropertyId) continue;
    if (propertyMatchesTowerUnit(row, tower, unitNumber)) {
      return {
        property: row,
        orgName: row.orgName,
        orgSlug: row.orgSlug,
      };
    }
  }
  return null;
}

export function duplicateTowerUnitMessage(tower: string, unitNumber: string): string {
  const label = formatTowerAndUnit(tower, unitNumber);
  return `${label} is already registered.`;
}
