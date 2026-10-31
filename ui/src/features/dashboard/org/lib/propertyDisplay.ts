import { formatTowerAndUnit } from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { Property } from '@/features/dashboard/org/types';

/** Primary sidebar label for a property (tower + unit when available). */
export function propertySidebarLabel(property: Property): string {
  if (property.tower && property.unitNumber) {
    return formatTowerAndUnit(property.tower, property.unitNumber);
  }
  if (property.towerAndUnit?.trim()) return property.towerAndUnit.trim();
  return property.name;
}

/** Tower + unit line for cards when distinct from the property name. */
export function propertyTowerUnitLine(property: Property): string | null {
  if (property.tower && property.unitNumber) {
    return formatTowerAndUnit(property.tower, property.unitNumber);
  }
  const legacy = property.towerAndUnit?.trim();
  if (legacy) return legacy;
  return null;
}

/** Property name for org property cards (falls back to tower/unit or name). */
export function propertyCardTitle(property: Property): string {
  const name = property.name.trim();
  if (name) return name;
  return propertySidebarLabel(property);
}

export { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyConstants';
