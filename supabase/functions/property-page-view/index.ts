/**
 * property-page-view — Host Analytics Phase 2b ingest.
 * Cheap, unauthenticated, fire-and-forget insert for the public property page pageview log.
 * POST body: { propertyId, sessionId, referrer?, utmSource?, utmMedium?, utmCampaign? }
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BOT_UA_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /slurp/i,
  /facebookexternalhit/i,
  /headless/i,
  /preview/i,
  /monitor/i,
];

function isLikelyBot(userAgent: string): boolean {
  if (!userAgent) return true;
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function deviceClassFromUserAgent(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function hostFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

function shortString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

servePublic('property-page-view', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 'Invalid JSON body', 400);
  }

  const propertyId = typeof body.propertyId === 'string' ? body.propertyId : '';
  const sessionId = shortString(body.sessionId, 64);

  if (!UUID_RE.test(propertyId) || !sessionId) {
    return jsonError(req, 'propertyId and sessionId are required', 400);
  }

  const limited = await rateLimitGate(req, {
    scope: 'property_page_view',
    identity: `${propertyId}:${sessionId}`,
    limit: 1,
    windowSec: 30,
  });
  if (limited) return limited;

  const userAgent = req.headers.get('user-agent') ?? '';
  const referrer = shortString(body.referrer, 512);

  const supabase = createServiceClient();

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, status')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError) throw new Error(propertyError.message);
  if (!property || property.status !== 'ACTIVE') {
    // Never leak whether a property exists — respond success either way.
    return jsonSuccess(req, { recorded: false });
  }

  const { error: insertError } = await supabase.from('property_page_views').insert({
    property_id: propertyId,
    session_id: sessionId,
    referrer_host: hostFromUrl(referrer),
    utm_source: shortString(body.utmSource, 128),
    utm_medium: shortString(body.utmMedium, 128),
    utm_campaign: shortString(body.utmCampaign, 128),
    device_class: deviceClassFromUserAgent(userAgent),
    is_bot: isLikelyBot(userAgent),
  });

  if (insertError) throw new Error(insertError.message);

  return jsonSuccess(req, { recorded: true });
});
