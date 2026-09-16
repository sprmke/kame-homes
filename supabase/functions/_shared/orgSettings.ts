/**
 * Organization-scoped operator settings (`org_settings` table).
 */

import { createClient } from './supabaseJs.ts';
import { DEFAULT_EMAIL_LOGO_URL } from './renderEmailHtml.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { resolveFacebookPageUrl, resolveOptionalSocialUrl } from './orgSocialLinks.ts';

export type OrgSettingsRow = {
  id: number;
  organization_id: string;
  updated_at: string;
  email_to: string | null;
  email_reply_to: string | null;
  parking_owner_emails: string | null;
  sd_refund_cron_email_lead_minutes: number | null;
  sd_refund_cron_max_checkout_age_days: number | null;
  public_guest_app_origin: string | null;
  facebook_reviews_url: string | null;
  airbnb_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  email_logo_url: string | null;
  default_parking_rate_guest: number | null;
  automation_toggles: Record<string, unknown> | null;
};

export type OrgSettingsResolved = {
  /** Resolved for merged app settings / emails — not editable per org in admin UI. */
  publicGuestAppOrigin: string;
  /** @deprecated Use facebookPageUrl in admin DTO; kept for appSettings merge. */
  facebookReviewsUrl: string;
  facebookPageUrl: string;
  airbnbUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  emailLogoUrl: string;
};

export type OrgSettingsFieldSource = 'db' | 'default';

export type OrgSettingsDto = Omit<
  OrgSettingsResolved,
  'publicGuestAppOrigin' | 'facebookReviewsUrl'
> & {
  updatedAt: string | null;
  fieldSources: Record<
    | 'facebookPageUrl'
    | 'airbnbUrl'
    | 'instagramUrl'
    | 'tiktokUrl'
    | 'emailLogoUrl',
    OrgSettingsFieldSource
  >;
};

const CACHE_TTL_MS = 30_000;
const cacheByOrg = new Map<string, { at: number; row: OrgSettingsRow | null }>();

export function invalidateOrgSettingsCache(organizationId?: string | null): void {
  if (organizationId) cacheByOrg.delete(organizationId);
  else cacheByOrg.clear();
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export async function loadOrgSettingsRow(organizationId: string): Promise<OrgSettingsRow | null> {
  const key = organizationId;
  const now = Date.now();
  const cached = cacheByOrg.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.row;
  }

  const { data, error } = await supabaseAdmin()
    .from('org_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.warn('[orgSettings] load failed:', error.message);
    cacheByOrg.set(key, { at: now, row: null });
    return null;
  }

  cacheByOrg.set(key, { at: now, row: data as OrgSettingsRow | null });
  return data as OrgSettingsRow | null;
}

export async function loadOrgSettingsRowByPropertyId(
  propertyId: string
): Promise<OrgSettingsRow | null> {
  const organizationId = await resolveOrganizationIdForProperty(propertyId);
  return loadOrgSettingsRow(organizationId);
}

function trimOrEmpty(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function pickDbString(dbVal: string | null | undefined): {
  value: string;
  source: OrgSettingsFieldSource;
} {
  const fromDb = trimOrEmpty(dbVal);
  if (fromDb) return { value: fromDb, source: 'db' };
  return { value: '', source: 'default' };
}

function pickDbInt(
  dbVal: number | null | undefined,
  fallback: number,
  min: number,
  max: number
): { value: number; source: OrgSettingsFieldSource } {
  if (dbVal != null && Number.isFinite(Number(dbVal))) {
    const n = Math.floor(Number(dbVal));
    if (n >= min && n <= max) {
      return { value: n, source: 'db' };
    }
  }
  return { value: fallback, source: 'default' };
}

function pickMoney(
  dbVal: number | null | undefined,
  fallback: number
): { value: number; source: OrgSettingsFieldSource } {
  if (dbVal != null) {
    const n = Number(dbVal);
    if (Number.isFinite(n) && n > 0) {
      return { value: n, source: 'db' };
    }
  }
  return { value: fallback, source: 'default' };
}

function parseCommaSeparatedEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

type OrgFieldPicks = {
  emailTo: ReturnType<typeof pickDbString>;
  emailReplyTo: ReturnType<typeof pickDbString>;
  parkingRaw: ReturnType<typeof pickDbString>;
  lead: ReturnType<typeof pickDbInt>;
  maxAge: ReturnType<typeof pickDbInt>;
  origin: ReturnType<typeof pickDbString>;
  facebook: ReturnType<typeof pickDbString>;
  airbnb: ReturnType<typeof pickDbString>;
  instagram: ReturnType<typeof pickDbString>;
  tiktok: ReturnType<typeof pickDbString>;
  logo: ReturnType<typeof pickDbString>;
  parkingRate: ReturnType<typeof pickMoney>;
};

export function pickOrgSettingsFieldsFromRow(row: OrgSettingsRow | null): OrgFieldPicks {
  const emailTo = pickDbString(row?.email_to);
  const emailReplyTo = pickDbString(row?.email_reply_to);
  const parkingRaw = pickDbString(row?.parking_owner_emails);
  const lead = pickDbInt(row?.sd_refund_cron_email_lead_minutes, 180, 0, 10080);
  const maxAge = pickDbInt(row?.sd_refund_cron_max_checkout_age_days, 30, 0, 365);
  const origin = pickDbString(row?.public_guest_app_origin);
  const facebook = pickDbString(row?.facebook_reviews_url);
  const airbnb = pickDbString(row?.airbnb_url);
  const instagram = pickDbString(row?.instagram_url);
  const tiktok = pickDbString(row?.tiktok_url);
  const logo = pickDbString(row?.email_logo_url);
  const parkingRate = pickMoney(row?.default_parking_rate_guest, 400);

  return {
    emailTo,
    emailReplyTo,
    parkingRaw,
    lead,
    maxAge,
    origin,
    facebook,
    airbnb,
    instagram,
    tiktok,
    logo,
    parkingRate,
  };
}

export async function resolveOrgSettings(organizationId: string): Promise<OrgSettingsResolved> {
  const row = await loadOrgSettingsRow(organizationId);
  const picks = pickOrgSettingsFieldsFromRow(row);

  const facebookPage = resolveFacebookPageUrl(picks.facebook.value || null);
  const airbnb = resolveOptionalSocialUrl(picks.airbnb.value || null, 'AIRBNB_URL');
  const instagram = resolveOptionalSocialUrl(picks.instagram.value || null, 'INSTAGRAM_URL');
  const tiktok = resolveOptionalSocialUrl(picks.tiktok.value || null, 'TIKTOK_URL');
  return {
    publicGuestAppOrigin: resolvePublicGuestAppOrigin(picks.origin.value || null),
    facebookReviewsUrl: facebookPage,
    facebookPageUrl: facebookPage,
    airbnbUrl: airbnb,
    instagramUrl: instagram,
    tiktokUrl: tiktok,
    emailLogoUrl: picks.logo.value || DEFAULT_EMAIL_LOGO_URL,
  };
}

export async function serializeOrgSettingsForAdmin(
  organizationId: string
): Promise<OrgSettingsDto> {
  const row = await loadOrgSettingsRow(organizationId);
  const picks = pickOrgSettingsFieldsFromRow(row);

  return {
    facebookPageUrl: picks.facebook.value,
    airbnbUrl: picks.airbnb.value,
    instagramUrl: picks.instagram.value,
    tiktokUrl: picks.tiktok.value,
    emailLogoUrl: picks.logo.value || DEFAULT_EMAIL_LOGO_URL,
    updatedAt: row?.updated_at ?? null,
    fieldSources: {
      facebookPageUrl: picks.facebook.source,
      airbnbUrl: picks.airbnb.source,
      instagramUrl: picks.instagram.source,
      tiktokUrl: picks.tiktok.source,
      emailLogoUrl: picks.logo.source,
    },
  };
}

export async function ensureOrgSettingsRow(organizationId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from('org_settings')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('org_settings').insert({
    organization_id: organizationId,
  });

  if (error?.code === '23505') return;

  if (error) {
    console.error('[orgSettings] ensure insert:', error.message);
    throw new Error(`Failed to seed org_settings for ${organizationId}`);
  }
}
