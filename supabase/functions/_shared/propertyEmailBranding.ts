/**
 * Property + org labels for workflow email From headers, subjects, and shells.
 */

import { createClient } from './supabaseJs.ts';
import { resolveAppSettings } from './appSettings.ts';
import { resolvePublicBrandName } from './platformBrand.ts';
import { getDefaultPropertyId } from './propertyScope.ts';

export type PropertyEmailBranding = {
  organizationName: string;
  propertyName: string;
  /** Default unit line when booking/form has no tower_and_unit */
  unitLabel: string;
  fromEmail: string;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: PropertyEmailBranding }>();

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/** Booking/form unit wins; else property GAF unit → DB tower_and_unit → property name. */
export function resolveEmailUnitLabel(
  explicitUnit: string | null | undefined,
  branding: PropertyEmailBranding
): string {
  const trimmed = String(explicitUnit ?? '').trim();
  return trimmed || branding.unitLabel;
}

export function formatResendFromAddress(displayName: string, email: string): string {
  const safeName = displayName.replace(/[\r\n<>"]/g, ' ').trim() || 'Property';
  return `${safeName} <${email.trim()}>`;
}

export function sanitizeAttachmentToken(raw: string): string {
  const token = raw
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return token || 'PROPERTY';
}

export function formatEmailDateRange(checkIn: string, checkOut: string): string {
  return `(${checkIn} to ${checkOut})`;
}

export async function loadPropertyEmailBranding(
  propertyId?: string | null
): Promise<PropertyEmailBranding> {
  const resolvedId = propertyId ?? (await getDefaultPropertyId());
  const hit = cache.get(resolvedId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const settings = await resolveAppSettings(resolvedId);
  const { data, error } = await supabaseAdmin()
    .from('properties')
    .select('name, tower_and_unit, organization_id')
    .eq('id', resolvedId)
    .maybeSingle();

  if (error) {
    console.warn('[propertyEmailBranding] property load failed:', error.message);
  }

  let orgName = '';
  const orgId = data?.organization_id as string | undefined;
  if (orgId) {
    const { data: org, error: orgErr } = await supabaseAdmin()
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) {
      console.warn('[propertyEmailBranding] org load failed:', orgErr.message);
    }
    orgName = String(org?.name ?? '').trim();
  }

  const propertyName = String(data?.name ?? '').trim();
  const unitLabel =
    settings.gafTowerAndUnitNumber?.trim() ||
    String(data?.tower_and_unit ?? '').trim() ||
    propertyName ||
    orgName ||
    'Property';

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || settings.emailReplyTo?.trim();
  if (!fromEmail) {
    throw new Error('Missing RESEND_FROM_EMAIL env or emailReplyTo in property app_settings');
  }

  const branding: PropertyEmailBranding = {
    organizationName: resolvePublicBrandName(orgName) || propertyName || 'Property',
    propertyName: propertyName || orgName || 'Property',
    unitLabel,
    fromEmail,
  };

  cache.set(resolvedId, { at: Date.now(), value: branding });
  return branding;
}
