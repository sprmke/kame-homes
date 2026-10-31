import { type GafDetailsValues } from '@/features/dashboard/bookings/lib/gafDefaults';

/** Pet PDF owner/unit fields — resolved from the same app_settings keys as GAF Details. */
export type PetDetailsValues = Pick<GafDetailsValues, 'gafUnitOwner' | 'gafTowerAndUnitNumber'>;

function extractTowerAndUnit(towerAndUnitNumber: string): {
  tower: string;
  unitNumber: string;
} {
  const match = towerAndUnitNumber.match(/^(.+?)\s+(\d+)$/);
  if (match) {
    return {
      tower: match[1].trim(),
      unitNumber: match[2].trim(),
    };
  }
  return {
    tower: towerAndUnitNumber,
    unitNumber: '',
  };
}

export function petDetailsToPdfFormFields(details: PetDetailsValues): Record<string, string> {
  const { tower, unitNumber } = extractTowerAndUnit(details.gafTowerAndUnitNumber);
  return {
    unitOwner: details.gafUnitOwner,
    unitTower: tower,
    unitNumber,
  };
}
