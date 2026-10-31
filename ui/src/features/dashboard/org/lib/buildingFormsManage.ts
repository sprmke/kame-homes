import type { GafDetailsValues } from '@/features/dashboard/bookings/lib/gafDefaults';

import {
  validateFullPersonName,
  validatePhilippineMobilePhone,
} from '@/lib/validation/fieldValidation';

export const BUILDING_FORMS_MANAGE_FIELD_IDS = [
  'gaf-unit-owner',
  'gaf-tower-unit',
  'gaf-onsite-contact',
  'gaf-owner-phone',
  'gaf-owner-signature',
] as const;

export type BuildingFormsManageFields = GafDetailsValues;

export function cloneBuildingFormsFields(
  values: BuildingFormsManageFields
): BuildingFormsManageFields {
  return {
    gafUnitOwner: values.gafUnitOwner,
    gafTowerAndUnitNumber: values.gafTowerAndUnitNumber,
    gafGuestsOnsiteContactPerson: values.gafGuestsOnsiteContactPerson,
    gafOwnerContactNumber: values.gafOwnerContactNumber,
  };
}

export function buildingFormsFieldsEqual(
  a: BuildingFormsManageFields,
  b: BuildingFormsManageFields
): boolean {
  return (
    a.gafUnitOwner.trim() === b.gafUnitOwner.trim() &&
    a.gafTowerAndUnitNumber.trim() === b.gafTowerAndUnitNumber.trim() &&
    a.gafGuestsOnsiteContactPerson.trim() === b.gafGuestsOnsiteContactPerson.trim() &&
    a.gafOwnerContactNumber.trim() === b.gafOwnerContactNumber.trim()
  );
}

function requireText(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

function requirePersonName(raw: string, emptyMessage: string): string | null {
  const empty = requireText(raw, emptyMessage);
  if (empty) return empty;
  return validateFullPersonName(raw);
}

function requirePhone(raw: string, emptyMessage: string): string | null {
  const empty = requireText(raw, emptyMessage);
  if (empty) return empty;
  return validatePhilippineMobilePhone(raw);
}

function requireTowerUnit(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Enter the tower and unit number';
  if (value.length < 3) return 'Enter a valid tower and unit number';
  return null;
}

/** First blocking validation error for Manage Save, or null when valid. */
export function validateBuildingFormsManage(
  values: BuildingFormsManageFields,
  signatureConfigured: boolean
): string | null {
  return (
    requirePersonName(values.gafUnitOwner, 'Enter the unit owner name') ||
    requireTowerUnit(values.gafTowerAndUnitNumber) ||
    requirePersonName(values.gafGuestsOnsiteContactPerson, 'Enter the on-site contact person') ||
    requirePhone(values.gafOwnerContactNumber, 'Enter the owner contact number') ||
    (signatureConfigured ? null : 'Upload the unit owner signature')
  );
}
