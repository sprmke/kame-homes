/**
 * Guest-facing contact + social links for workflow emails.
 * Team members (property team manager, then org owner) are the source of truth.
 */

import { createClient } from './supabaseJs.ts';
import type { AppSettingsResolved } from './appSettings.ts';
import { formatPhilippineMobileDisplay } from './fieldValidation.ts';
import { DEFAULT_FACEBOOK_PAGE_URL } from './orgSocialLinks.ts';
import { hasPropertyTeamManageAccess, normalizePermissionIds } from './propertyTeamPermissions.ts';
import { escapeHtml, emailSocialLinkStyle } from './renderEmailHtml.ts';

export type GuestFacingContactInfo = {
  facebookPageUrl: string;
  airbnbUrl: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

/** @deprecated Use GuestFacingContactInfo */
export type GuestContactInfo = GuestFacingContactInfo;

function facebookLabelHtml(facebookPageUrl: string, brandColor?: string | null): string {
  const url = facebookPageUrl.trim();
  const label = 'Facebook';
  const linkStyle = emailSocialLinkStyle(brandColor);
  if (url && url !== DEFAULT_FACEBOOK_PAGE_URL) {
    return `<a href="${escapeHtml(url)}" style="${linkStyle}">${label}</a>`;
  }
  return label;
}

function airbnbLabelHtml(airbnbUrl: string, brandColor?: string | null): string {
  const url = airbnbUrl.trim();
  const label = 'Airbnb';
  const linkStyle = emailSocialLinkStyle(brandColor);
  if (url) {
    return `<a href="${escapeHtml(url)}" style="${linkStyle}">${label}</a>`;
  }
  return label;
}

/** “message us on Facebook or Airbnb” — only platform names are linked when URLs exist. */
export function buildSocialContactMentionsHtml(
  contact: Pick<GuestFacingContactInfo, 'facebookPageUrl' | 'airbnbUrl'>,
  brandColor?: string | null
): string {
  return `message us on ${facebookLabelHtml(contact.facebookPageUrl, brandColor)} or ${airbnbLabelHtml(contact.airbnbUrl, brandColor)}`;
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

type AuthProfile = { name: string; email: string };

async function getAuthProfile(userId: string): Promise<AuthProfile> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return { name: 'Host', email: '' };
  }
  const email = data.user.email ?? '';
  const meta = data.user.user_metadata ?? {};
  const name =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === 'string' && meta.name.trim()
        ? meta.name.trim()
        : email.split('@')[0] || 'Host';
  return { name, email };
}

function readSettingsString(
  settings: Record<string, unknown> | null | undefined,
  key: string
): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return '';
  }
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function loadHostContactFromTeam(propertyId: string): Promise<{
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}> {
  const supabase = supabaseAdmin();

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError || !property?.organization_id) {
    return { contactName: '', contactPhone: '', contactEmail: '' };
  }

  const orgId = property.organization_id as string;

  const { data: members } = await supabase
    .from('property_members')
    .select('user_id, display_name, contact_phone, permissions, assigned_at')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: true });

  for (const row of members ?? []) {
    const permissions = normalizePermissionIds(row.permissions);
    if (!hasPropertyTeamManageAccess(permissions)) continue;
    const profile = await getAuthProfile(row.user_id as string);
    const name =
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : profile.name;
    const phone = typeof row.contact_phone === 'string' ? row.contact_phone.trim() : '';
    const email = profile.email;
    if (name || phone || email) {
      return { contactName: name, contactPhone: phone, contactEmail: email };
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .maybeSingle();

  const ownerId = org?.owner_id as string | undefined;
  if (ownerId) {
    const { data: ownerMember } = await supabase
      .from('organization_members')
      .select('display_name, contact_phone')
      .eq('organization_id', orgId)
      .eq('user_id', ownerId)
      .maybeSingle();

    const profile = await getAuthProfile(ownerId);
    const name =
      typeof ownerMember?.display_name === 'string' && ownerMember.display_name.trim()
        ? ownerMember.display_name.trim()
        : profile.name;
    const phone =
      typeof ownerMember?.contact_phone === 'string' ? ownerMember.contact_phone.trim() : '';
    return {
      contactName: name,
      contactPhone: phone,
      contactEmail: profile.email,
    };
  }

  return { contactName: '', contactPhone: '', contactEmail: '' };
}

export function buildGuestFacingPlaceholderVars(
  contact: GuestFacingContactInfo
): Record<string, string> {
  return {
    facebook_page_url: escapeHtml(contact.facebookPageUrl),
    airbnb_url: escapeHtml(contact.airbnbUrl),
    contact_name: escapeHtml(contact.contactName),
    contact_phone: escapeHtml(
      contact.contactPhone ? formatPhilippineMobileDisplay(contact.contactPhone) : ''
    ),
    contact_email: escapeHtml(contact.contactEmail),
    social_contact_mentions: buildSocialContactMentionsHtml(contact),
  };
}

export async function loadGuestFacingContactInfo(
  propertyId: string | undefined | null,
  settings: AppSettingsResolved
): Promise<GuestFacingContactInfo> {
  let contactName = '';
  let contactPhone = '';
  let contactEmail = '';

  if (propertyId) {
    const teamContact = await loadHostContactFromTeam(propertyId);
    contactName = teamContact.contactName;
    contactPhone = teamContact.contactPhone;
    contactEmail = teamContact.contactEmail;
  }

  // Legacy fallback while properties still have stale settings.contact* values.
  if (!contactName && !contactPhone && !contactEmail && propertyId) {
    const supabase = supabaseAdmin();
    const { data: property } = await supabase
      .from('properties')
      .select('settings, organization_id')
      .eq('id', propertyId)
      .maybeSingle();

    const propertySettings = property?.settings as Record<string, unknown> | null | undefined;
    contactName = readSettingsString(propertySettings, 'contactName');
    contactPhone = readSettingsString(propertySettings, 'contactPhone');
    contactEmail = readSettingsString(propertySettings, 'contactEmail');

    if (!contactName && property?.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', property.organization_id as string)
        .maybeSingle();
      const orgSettings = org?.settings as Record<string, unknown> | null | undefined;
      contactName = readSettingsString(orgSettings, 'contactName');
      contactPhone = readSettingsString(orgSettings, 'contactPhone');
      contactEmail = readSettingsString(orgSettings, 'contactEmail');
    }
  }

  return {
    facebookPageUrl: settings.facebookReviewsUrl,
    airbnbUrl: settings.airbnbUrl,
    contactName,
    contactPhone,
    contactEmail,
  };
}

/** @deprecated Use loadGuestFacingContactInfo */
export const loadGuestContactInfo = loadGuestFacingContactInfo;
