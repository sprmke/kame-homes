import {
  validateEmailAddress,
  validateFullPersonName,
  validatePhilippineMobilePhone,
} from './fieldValidation.ts';

export const ORG_TAGLINE_MAX_LENGTH = 60;
export const ORG_DESCRIPTION_MAX_LENGTH = 500;

const ORG_CONTACT_ROLE_VALUES = [
  'property_owner',
  'authorized_representative',
  'sublessee',
  'property_admin',
] as const;

export function validateOrgTagline(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > ORG_TAGLINE_MAX_LENGTH) {
    return `Tagline must be ${ORG_TAGLINE_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

export function validateOrgDescription(value: string): string | null {
  if (value.length > ORG_DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${ORG_DESCRIPTION_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_ORG_BRAND_COLOR = '#24a88e';

export function resolveOrgBrandColorFromSettings(
  settings: Record<string, unknown> | null | undefined
): string {
  const raw = settings?.brandColor;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  }
  return DEFAULT_ORG_BRAND_COLOR;
}

export function validateOrgBrandColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HEX_COLOR_RE.test(trimmed)) {
    return 'Brand color must be a valid hex color (e.g. #24a88e)';
  }
  return null;
}

export function validateOrgContactRole(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!ORG_CONTACT_ROLE_VALUES.includes(trimmed as (typeof ORG_CONTACT_ROLE_VALUES)[number])) {
    return 'Please select a valid contact role';
  }
  return null;
}

export function validateOrgContactSettingsFields(input: {
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
}): string | null {
  if (typeof input.contactName === 'string') {
    const err = validateFullPersonName(input.contactName);
    if (err) return err;
  }
  if (typeof input.contactRole === 'string') {
    const err = validateOrgContactRole(input.contactRole);
    if (err) return err;
  }
  if (typeof input.contactPhone === 'string') {
    const err = validatePhilippineMobilePhone(input.contactPhone);
    if (err) return err;
  }
  if (typeof input.contactEmail === 'string') {
    const err = validateEmailAddress(input.contactEmail);
    if (err) return err;
  }
  return null;
}
