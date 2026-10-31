export const DUPLICATE_ORGANIZATION_NAME_MESSAGE = 'An organization with this name already exists';

export const ORG_TAGLINE_MAX_LENGTH = 60;
export const ORG_DESCRIPTION_MAX_LENGTH = 500;
export { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';

export const ORG_CONTACT_ROLE_VALUES = [
  'property_owner',
  'authorized_representative',
  'sublessee',
  'property_admin',
] as const;

export type OrgContactRole = (typeof ORG_CONTACT_ROLE_VALUES)[number];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

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
  if (!ORG_CONTACT_ROLE_VALUES.includes(trimmed as OrgContactRole)) {
    return 'Please select a valid contact role';
  }
  return null;
}

export function readOrgSettingsString(
  settings: Record<string, unknown> | undefined,
  key: string
): string {
  const value = settings?.[key];
  return typeof value === 'string' ? value : '';
}
