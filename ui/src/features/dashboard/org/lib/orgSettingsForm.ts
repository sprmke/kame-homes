import { ORG_NAME_MAX_LENGTH } from '@/features/dashboard/org/lib/orgSettingsCompletion';
import {
  DEFAULT_ORG_BRAND_COLOR,
  ORG_CONTACT_ROLE_VALUES,
  readOrgSettingsString,
  validateOrgBrandColor,
  validateOrgDescription,
  validateOrgTagline,
  type OrgContactRole,
} from '@/features/dashboard/org/lib/orgSettingsValidation';

/** @deprecated Use slugifyOrgName — kept for property settings slug fields. */
export function normalizeSlugInput(value: string): string {
  return slugifyOrgName(value);
}

/** Mirrors server `slugifyName` for read-only slug preview. */
export function slugifyOrgName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 64) || 'item'
  );
}

export type OrgSettingsDraft = {
  name: string;
  description: string;
  tagline: string;
  brandColor: string;
  contactName: string;
  contactRole: OrgContactRole | '';
  contactPhone: string;
  contactEmail: string;
};

function readOrgContactRole(settings: Record<string, unknown> | undefined): OrgContactRole | '' {
  const raw = readOrgSettingsString(settings, 'contactRole');
  return ORG_CONTACT_ROLE_VALUES.includes(raw as OrgContactRole) ? (raw as OrgContactRole) : '';
}

export function orgSettingsDraftFromOrg(org: {
  name: string;
  description: string | null;
  settings?: Record<string, unknown>;
}): OrgSettingsDraft {
  return {
    name: org.name,
    description: org.description ?? '',
    tagline: readOrgSettingsString(org.settings, 'tagline'),
    brandColor: readOrgSettingsString(org.settings, 'brandColor') || DEFAULT_ORG_BRAND_COLOR,
    contactName: readOrgSettingsString(org.settings, 'contactName'),
    contactRole: readOrgContactRole(org.settings),
    contactPhone: readOrgSettingsString(org.settings, 'contactPhone'),
    contactEmail: readOrgSettingsString(org.settings, 'contactEmail'),
  };
}

export function orgSettingsDraftIsDirty(
  draft: OrgSettingsDraft,
  baseline: OrgSettingsDraft
): boolean {
  return (
    draft.name.trim() !== baseline.name.trim() ||
    draft.description.trim() !== baseline.description.trim() ||
    draft.tagline.trim() !== baseline.tagline.trim() ||
    draft.brandColor.trim().toLowerCase() !== baseline.brandColor.trim().toLowerCase()
  );
}

export function orgSettingsDraftToPayload(
  draft: OrgSettingsDraft,
  orgId: string
): {
  orgId: string;
  name: string;
  description: string;
  tagline: string;
  brandColor: string;
} {
  return {
    orgId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    tagline: draft.tagline.trim(),
    brandColor: draft.brandColor.trim(),
  };
}

export function validateOrgSettingsDraft(draft: OrgSettingsDraft): string | null {
  if (draft.name.trim().length < 2) {
    return 'Organization name must be at least 2 characters';
  }
  if (draft.name.trim().length > ORG_NAME_MAX_LENGTH) {
    return `Organization name must be ${ORG_NAME_MAX_LENGTH} characters or fewer`;
  }
  const taglineErr = validateOrgTagline(draft.tagline);
  if (taglineErr) return taglineErr;
  const descriptionErr = validateOrgDescription(draft.description);
  if (descriptionErr) return descriptionErr;
  const brandColorErr = validateOrgBrandColor(draft.brandColor);
  if (brandColorErr) return brandColorErr;

  return null;
}

/** Live slug preview while editing; falls back to saved slug when name is unchanged. */
export function orgSlugPreview(draftName: string, savedSlug: string, baselineName: string): string {
  if (draftName.trim() === baselineName.trim()) {
    return savedSlug;
  }
  if (draftName.trim().length < 2) {
    return savedSlug;
  }
  return slugifyOrgName(draftName);
}
