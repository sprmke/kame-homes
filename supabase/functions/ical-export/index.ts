/**
 * ical-export — public, token-guarded outbound calendar feed for OTAs to import.
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §8 / §10
 *
 *   GET /functions/v1/ical-export?property=<slug>&token=<t>[&as=<provider>]
 *
 * Returns `text/calendar` listing this property's busy nights (direct bookings + manual owner
 * blocks) as opaque `Booked` / `Blocked` events — ZERO guest PII. `as` sets the "exclude this
 * origin" filter so an OTA never re-imports its own reservations (loop prevention).
 *
 * Any failure (bad/rotated token, unknown property, disabled feed) returns an identical 404 —
 * no enumeration.
 *
 * Feature availability: no gate on this endpoint (export feeds keep serving while
 * `pricing.channel_sync` is off). See docs/workflow/in-progress/feature-availability-controls.md
 * Phase 5.4.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { buildExportCalendar, loadExportRanges } from '../_shared/calendarSyncRun.ts';
import type { CalendarFeedProvider } from '../_shared/calendarSyncService.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { readPropertySlugFromUrl, resolvePropertyIdBySlug } from '../_shared/propertyScope.ts';
import { capturePostHogException } from '../_shared/posthog.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

const PROVIDERS: readonly CalendarFeedProvider[] = ['airbnb', 'booking_com', 'vrbo', 'other'];

function notFound(req: Request): Response {
  return new Response('Not found', {
    status: 404,
    headers: { ...corsHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function weakEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `W/"${hex}"`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'GET') return notFound(req);

  const limited = await publicGetRateLimitGate(req, 'ical-export', { maxPerMin: 30 });
  if (limited) {
    return new Response('Too many requests', {
      status: 429,
      headers: { ...corsHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const url = new URL(req.url);
    const slug = readPropertySlugFromUrl(url);
    const token = url.searchParams.get('token')?.trim() ?? '';
    if (!slug || !token) return notFound(req);

    const asParam = url.searchParams.get('as')?.trim().toLowerCase() ?? '';
    const excludeProvider =
      asParam && (PROVIDERS as readonly string[]).includes(asParam)
        ? (asParam as CalendarFeedProvider)
        : null;

    const propertyId = await resolvePropertyIdBySlug(slug);
    if (!propertyId) return notFound(req);

    const supabase = createServiceClient();
    const { data: exportRow } = await supabase
      .from('property_calendar_export')
      .select('token, is_enabled')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (!exportRow || exportRow.is_enabled !== true || typeof exportRow.token !== 'string') {
      return notFound(req);
    }
    if (!safeEqual(token, exportRow.token)) return notFound(req);

    const { data: propertyRow } = await supabase
      .from('properties')
      .select('name, tower_and_unit')
      .eq('id', propertyId)
      .maybeSingle();
    const calendarName = `${propertyRow?.name ?? propertyRow?.tower_and_unit ?? 'Property'} (GFM)`;

    const { ranges, lastModifiedIso } = await loadExportRanges(
      supabase,
      propertyId,
      excludeProvider
    );
    const projectRef =
      (Deno.env.get('SUPABASE_URL') ?? '').match(/https?:\/\/([^.]+)\./)?.[1] ?? 'gfm';

    const body = buildExportCalendar({
      calendarName,
      uidDomain: projectRef,
      ranges,
      lastModifiedIso,
    });

    const etag = await weakEtag(body);
    const lastModifiedHttp = lastModifiedIso ? new Date(lastModifiedIso).toUTCString() : undefined;

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders(req),
          ETag: etag,
          'Cache-Control': 'public, max-age=900',
        },
      });
    }

    // Best-effort "last fetched" stamp.
    void (async () => {
      try {
        await supabase
          .from('property_calendar_export')
          .update({ last_served_at: new Date().toISOString() })
          .eq('property_id', propertyId);
      } catch {
        /* non-fatal */
      }
    })();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="gfm-calendar.ics"',
        'Cache-Control': 'public, max-age=900',
        ETag: etag,
        ...(lastModifiedHttp ? { 'Last-Modified': lastModifiedHttp } : {}),
      },
    });
  } catch (err) {
    console.error('[ical-export] error:', err);
    await capturePostHogException(err, { logPrefix: 'ical-export', request: req });
    // Still a 404 — never leak internals on this public endpoint.
    return notFound(req);
  }
});
