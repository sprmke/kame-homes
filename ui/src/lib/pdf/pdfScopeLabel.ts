import { formatParkingLocation } from '@/features/dashboard/org/lib/formatParkingLocation';
import { propertyTowerUnitLine } from '@/features/dashboard/org/lib/propertyDisplay';
import type { Parking, Property } from '@/features/dashboard/org/types';

/** Scope identity for PDF footers — tower/unit or parking location only. */
export type PdfScopeIdentity = {
  /** Tower + unit, parking slot line, or fallback name. */
  label: string;
};

/** Property unit line for header/footer — never the residence/building name alone. */
export function pdfPropertyScope(property: Property): PdfScopeIdentity {
  const towerUnit = propertyTowerUnitLine(property);
  const name = property.name.trim();
  return { label: towerUnit || name || 'Property' };
}

export function pdfParkingScope(parking: Parking): PdfScopeIdentity {
  const location = formatParkingLocation(parking.tower, parking.level, parking.slotLabel);
  const name = parking.name.trim();
  if (location && name && name.toLowerCase() !== location.toLowerCase()) {
    return { label: location };
  }
  return { label: location || name || 'Parking' };
}

export function pdfScopeFooterLabel(scope: PdfScopeIdentity | null | undefined): string | null {
  const label = scope?.label.trim();
  return label || null;
}
