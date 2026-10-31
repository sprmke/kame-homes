/**
 * Shared property-profile patch logic — single source of truth for `update-property` and the
 * AI dashboard assistant's `propose_update_property_profile` / `propose_update_property_settings`
 * tools.
 *
 * `applyPropertySettingsPatch` intentionally only forwards the fields `validatePropertySettingsPatch`
 * actually validates (contact info, capacity, description, custom house rules/amenities, cancellation
 * policy) — never an arbitrary `settings` object. `properties.settings` also holds other concerns
 * (payment methods, media, doc requirements, …) with no dedicated validator found in this codebase;
 * those stay out of both the read and write tool until a real validator exists to check them against
 * — see the AI dashboard assistant v2 plan, Phase 4.
 */

import {
  allocatePropertySlug,
  createServiceClient,
  serializeProperty,
  type PropertyRow,
} from './orgAuth.ts';
import {
  DUPLICATE_PROPERTY_NAME_MESSAGE,
  findPropertyNameConflict,
} from './propertyNameConflict.ts';
import { validatePropertySettingsPatch } from './propertySettingsValidation.ts';
import {
  DUPLICATE_TOWER_UNIT_MESSAGE,
  findPropertyTowerUnitConflict,
  parsePropertyTowerUnitFromBody,
} from './propertyTowerUnit.ts';

export type PropertyProfilePatchInput = {
  name?: string;
  address?: string;
  maxGuests?: number;
  status?: string;
  tower?: string;
  unitNumber?: string;
  residenceName?: string;
};

export class PropertyProfilePatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Validates + applies a top-level profile patch to an already-loaded property row. */
export async function applyPropertyProfilePatch(
  property: PropertyRow,
  fields: PropertyProfilePatchInput
): Promise<ReturnType<typeof serializeProperty>> {
  const patch: Record<string, unknown> = {};

  if (typeof fields.name === 'string') {
    const name = fields.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new PropertyProfilePatchError('Property name must be 2–120 characters');
    }
    const supabase = createServiceClient();
    const conflict = await findPropertyNameConflict(supabase, name, property.id);
    if (conflict) {
      throw new PropertyProfilePatchError(DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
    }
    patch.name = name;
  }

  if (typeof fields.tower === 'string' || typeof fields.unitNumber === 'string') {
    const residenceForTower =
      typeof fields.residenceName === 'string'
        ? fields.residenceName.trim()
        : property.residence_name;
    const parsed = parsePropertyTowerUnitFromBody(
      { tower: fields.tower, unitNumber: fields.unitNumber },
      { residenceName: residenceForTower }
    );
    if (!parsed.ok) {
      throw new PropertyProfilePatchError(parsed.error);
    }
    patch.tower = parsed.tower;
    patch.unit_number = parsed.unitNumber;
    patch.tower_and_unit = parsed.towerAndUnit;
  }

  if (typeof fields.residenceName === 'string') {
    patch.residence_name = fields.residenceName.trim() || null;
  }

  if (typeof fields.address === 'string') {
    patch.address = fields.address.trim() || null;
  }

  if (typeof fields.maxGuests === 'number') {
    if (fields.maxGuests <= 0) {
      throw new PropertyProfilePatchError('maxGuests must be positive');
    }
    patch.max_guests = Math.round(fields.maxGuests);
  }

  if (typeof fields.status === 'string') {
    const status = fields.status.trim().toUpperCase();
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new PropertyProfilePatchError('status must be ACTIVE or INACTIVE');
    }
    patch.status = status;
  }

  if (Object.keys(patch).length === 0) {
    throw new PropertyProfilePatchError('No valid fields to update');
  }

  const supabase = createServiceClient();

  const resultingStatus = String(
    (patch.status as string | undefined) ?? property.status ?? 'ACTIVE'
  ).toUpperCase();
  const resultingTower = (patch.tower as string | undefined) ?? property.tower;
  const resultingUnit = (patch.unit_number as string | undefined) ?? property.unit_number;

  if (
    resultingStatus === 'ACTIVE' &&
    typeof resultingTower === 'string' &&
    resultingTower &&
    typeof resultingUnit === 'string' &&
    resultingUnit
  ) {
    const conflict = await findPropertyTowerUnitConflict(
      supabase,
      resultingTower,
      resultingUnit,
      property.id
    );
    if (conflict) {
      throw new PropertyProfilePatchError(DUPLICATE_TOWER_UNIT_MESSAGE, 409);
    }
  }

  if (typeof patch.name === 'string') {
    patch.slug = await allocatePropertySlug(supabase, patch.name as string, undefined, property.id);
  }

  const { data, error } = await supabase
    .from('properties')
    .update(patch)
    .eq('id', property.id)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      if (patch.tower || patch.unit_number) {
        throw new PropertyProfilePatchError(DUPLICATE_TOWER_UNIT_MESSAGE, 409);
      }
      if (patch.name) {
        throw new PropertyProfilePatchError(DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
      }
      throw new PropertyProfilePatchError('Slug is already taken', 409);
    }
    throw new PropertyProfilePatchError('Failed to update property', 500);
  }

  return serializeProperty(data);
}

/**
 * The only `properties.settings` sub-fields this service will ever write — every one of them is
 * actually checked by `validatePropertySettingsPatch`. Add a key here ONLY after confirming the
 * validator covers it; do not widen this to a pass-through of whatever a caller sends.
 */
export type PropertySettingsPatchInput = {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  maxAdults?: number;
  maxChildren?: number;
  description?: string;
  customHouseRules?: Array<{ name: string }>;
  customAmenities?: Array<{ name: string }>;
  cancellationPolicy?: unknown;
};

const PROPERTY_SETTINGS_PATCH_KEYS: ReadonlyArray<keyof PropertySettingsPatchInput> = [
  'contactName',
  'contactPhone',
  'contactEmail',
  'bedrooms',
  'bathrooms',
  'floors',
  'maxAdults',
  'maxChildren',
  'description',
  'customHouseRules',
  'customAmenities',
  'cancellationPolicy',
];

/**
 * Validates + merges a `properties.settings` patch, allowlisted and validated exactly like
 * `update-property`'s settings branch. Never accepts fields outside `PROPERTY_SETTINGS_PATCH_KEYS`
 * — any other key on the input object (e.g. `media`, or something an untrusted caller made up) is
 * silently dropped, not merged in.
 */
export async function applyPropertySettingsPatch(
  property: PropertyRow,
  fields: PropertySettingsPatchInput
): Promise<ReturnType<typeof serializeProperty>> {
  const incoming: Record<string, unknown> = {};
  for (const key of PROPERTY_SETTINGS_PATCH_KEYS) {
    if (fields[key] !== undefined) incoming[key] = fields[key];
  }

  if (Object.keys(incoming).length === 0) {
    throw new PropertyProfilePatchError('No valid settings fields to update');
  }

  const validationError = validatePropertySettingsPatch(incoming, {
    residenceName: property.residence_name,
  });
  if (validationError) {
    throw new PropertyProfilePatchError(validationError);
  }

  const currentSettings =
    property.settings && typeof property.settings === 'object' && !Array.isArray(property.settings)
      ? (property.settings as Record<string, unknown>)
      : {};

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .update({ settings: { ...currentSettings, ...incoming } })
    .eq('id', property.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new PropertyProfilePatchError('Failed to update property settings', 500);
  }

  return serializeProperty(data);
}
