/**
 * Per-property guest form settings — keep in sync with guest-form-configurable-sections plan
 * and ui/src/features/guest/form/hooks/useGuestPaymentInfo.ts.
 */

import { DEFAULT_CLEANING_BUFFER_MINUTES, isValidCleaningBufferMinutes } from './cleaningBuffer.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolvePublicBrandName } from './platformBrand.ts';
import { normalizePropertyMediaItems } from './propertyMedia.ts';
import {
  DEFAULT_RESIDENCE_NAME,
  getResidencePropertyDefaults,
} from './propertyResidenceDefaults.ts';

export type GuestFormSettings = {
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
  checkInTime: string;
  checkOutTime: string;
  /** Required minutes between a checkout and the next check-in on a same-day turnover (min 1 hour). */
  cleaningBufferMinutes: number;
  maxAdults: number;
  maxChildren: number;
  propertyName: string;
  propertyEyebrow: string;
  propertyCoverImageUrl: string | null;
  residenceName: string | null;
  organizationName: string;
};

export const DEFAULT_GUEST_FORM_SETTINGS: GuestFormSettings = {
  allowPets: true,
  allowParking: true,
  allowSurpriseDecor: true,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  cleaningBufferMinutes: DEFAULT_CLEANING_BUFFER_MINUTES,
  maxAdults: 4,
  maxChildren: 0,
  propertyName: '',
  propertyEyebrow: '',
  propertyCoverImageUrl: null,
  residenceName: null,
  organizationName: '',
};

function readSettingsBoolean(
  settings: Record<string, unknown>,
  key: string,
  defaultValue = true
): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : defaultValue;
}

function readSettingsString(
  settings: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readSettingsNumber(
  settings: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const parsed = Number(settings[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPropertyEyebrow(
  propertyName: string,
  residenceName: string | null,
  towerAndUnit: string | null
): string {
  const unit = towerAndUnit?.trim() || propertyName.trim();
  const residence = residenceName?.trim();
  if (unit && residence) return `${unit} · ${residence}`;
  return unit || residence || propertyName.trim();
}

/** Reads properties.settings guest-form keys; missing booleans default true. */
export async function resolveGuestFormSettings(propertyId: string): Promise<GuestFormSettings> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('name, tower_and_unit, residence_name, settings, organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[guestFormSettings] property load failed:', error.message);
    return { ...DEFAULT_GUEST_FORM_SETTINGS };
  }

  const settings =
    data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? (data.settings as Record<string, unknown>)
      : {};

  const residenceName = typeof data?.residence_name === 'string' ? data.residence_name.trim() : '';
  const residenceDefaults = getResidencePropertyDefaults(residenceName || DEFAULT_RESIDENCE_NAME);

  const propertyName = String(data?.name ?? '').trim();
  const towerAndUnit = String(data?.tower_and_unit ?? '').trim() || null;

  const media = normalizePropertyMediaItems(settings.media);
  const primaryImage =
    media.find((item) => item.isPrimary && item.type === 'image') ??
    media.find((item) => item.type === 'image');

  let organizationName = '';
  const organizationId = data?.organization_id as string | undefined;
  if (organizationId) {
    const { data: org, error: orgError } = await createServiceClient()
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    if (orgError) {
      console.warn('[guestFormSettings] org load failed:', orgError.message);
    }
    organizationName = String(org?.name ?? '').trim();
  }

  return {
    allowPets: readSettingsBoolean(settings, 'allowPets', true),
    allowParking: readSettingsBoolean(settings, 'allowParking', true),
    allowSurpriseDecor: readSettingsBoolean(settings, 'allowSurpriseDecor', true),
    checkInTime: readSettingsString(settings, 'checkInTime', residenceDefaults.checkInTime),
    checkOutTime: readSettingsString(settings, 'checkOutTime', residenceDefaults.checkOutTime),
    cleaningBufferMinutes: (() => {
      const value = settings.cleaningBufferMinutes;
      return typeof value === 'number' && isValidCleaningBufferMinutes(value)
        ? value
        : DEFAULT_CLEANING_BUFFER_MINUTES;
    })(),
    maxAdults: readSettingsNumber(settings, 'maxAdults', residenceDefaults.maxAdults.default),
    maxChildren: Math.max(
      readSettingsNumber(settings, 'maxChildren', residenceDefaults.maxChildren.default),
      0
    ),
    propertyName,
    propertyEyebrow: buildPropertyEyebrow(propertyName, residenceName || null, towerAndUnit),
    propertyCoverImageUrl: primaryImage?.url?.trim() || null,
    residenceName: residenceName || null,
    organizationName: resolvePublicBrandName(organizationName) || propertyName || 'Host',
  };
}
