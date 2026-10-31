/**
 * Shared org-profile patch logic — single source of truth for `update-organization` and the
 * AI dashboard assistant's `propose_update_org_profile` tool, so slug-conflict handling and
 * settings-merge behavior can't silently drift between the two callers.
 */

import {
  allocateOrganizationSlug,
  createServiceClient,
  serializeOrganization,
  type OrgRow,
} from './orgAuth.ts';
import {
  DUPLICATE_ORGANIZATION_NAME_MESSAGE,
  findOrganizationNameConflict,
} from './orgNameConflict.ts';
import {
  validateOrgBrandColor,
  validateOrgContactSettingsFields,
  validateOrgDescription,
  validateOrgTagline,
} from './orgSettingsValidation.ts';
import { invalidateAppSettingsCache } from './appSettings.ts';
import { invalidateOrgBrandColorCache } from './orgBrandColor.ts';

export type OrgProfilePatchInput = {
  name?: string;
  description?: string;
  logoUrl?: string;
  tagline?: string;
  brandColor?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export class OrgProfilePatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Validates + applies a profile patch to an already-loaded org row. Throws OrgProfilePatchError on any validation/conflict failure. */
export async function applyOrganizationProfilePatch(
  org: OrgRow,
  fields: OrgProfilePatchInput
): Promise<ReturnType<typeof serializeOrganization>> {
  const patch: Record<string, unknown> = {};
  let settingsPatch: Record<string, unknown> | null = null;

  if (typeof fields.name === 'string') {
    const name = fields.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new OrgProfilePatchError('Organization name must be 2–120 characters');
    }
    patch.name = name;
  }

  if (typeof fields.description === 'string') {
    const err = validateOrgDescription(fields.description);
    if (err) throw new OrgProfilePatchError(err);
    patch.description = fields.description.trim() || null;
  }

  if (typeof fields.logoUrl === 'string') {
    patch.logo_url = fields.logoUrl.trim() || null;
  }

  if (typeof fields.tagline === 'string') {
    const err = validateOrgTagline(fields.tagline);
    if (err) throw new OrgProfilePatchError(err);
    settingsPatch = settingsPatch ?? {};
    settingsPatch.tagline = fields.tagline.trim() || null;
  }

  if (typeof fields.brandColor === 'string') {
    const err = validateOrgBrandColor(fields.brandColor);
    if (err) throw new OrgProfilePatchError(err);
    settingsPatch = settingsPatch ?? {};
    settingsPatch.brandColor = fields.brandColor.trim() || null;
  }

  const contactFields: Record<string, string> = {};
  if (typeof fields.contactName === 'string') contactFields.contactName = fields.contactName;
  if (typeof fields.contactRole === 'string') contactFields.contactRole = fields.contactRole;
  if (typeof fields.contactPhone === 'string') contactFields.contactPhone = fields.contactPhone;
  if (typeof fields.contactEmail === 'string') contactFields.contactEmail = fields.contactEmail;
  if (Object.keys(contactFields).length > 0) {
    const err = validateOrgContactSettingsFields(contactFields);
    if (err) throw new OrgProfilePatchError(err);
    settingsPatch = settingsPatch ?? {};
    for (const [key, value] of Object.entries(contactFields)) {
      settingsPatch[key] = value.trim() || null;
    }
  }

  if (Object.keys(patch).length === 0 && !settingsPatch) {
    throw new OrgProfilePatchError('No valid fields to update');
  }

  const supabase = createServiceClient();

  if (typeof patch.name === 'string') {
    let conflict: boolean;
    try {
      conflict = await findOrganizationNameConflict(supabase, patch.name as string, org.id);
    } catch (e) {
      // Preserve the underlying diagnostic message (e.g. a transient DB error) instead of
      // letting it fall through to the caller's generic "Failed to update organization".
      throw new OrgProfilePatchError(e instanceof Error ? e.message : 'Validation failed', 500);
    }
    if (conflict) {
      throw new OrgProfilePatchError(DUPLICATE_ORGANIZATION_NAME_MESSAGE, 409);
    }
    patch.slug = await allocateOrganizationSlug(supabase, patch.name as string, undefined, org.id);
  }

  if (settingsPatch) {
    const currentSettings =
      org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    patch.settings = { ...currentSettings, ...settingsPatch };
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(patch)
    .eq('id', org.id)
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      const message =
        typeof patch.name === 'string'
          ? DUPLICATE_ORGANIZATION_NAME_MESSAGE
          : 'Slug is already taken';
      throw new OrgProfilePatchError(message, 409);
    }
    throw new OrgProfilePatchError('Failed to update organization', 500);
  }

  if (settingsPatch?.brandColor !== undefined) {
    invalidateOrgBrandColorCache();
    invalidateAppSettingsCache();
  }

  return serializeOrganization(data);
}
