/**
 * public-sitemap — sitemap.xml for the public guest site (served at /sitemap.xml by the
 * Vercel middleware). Auth: anon key (verify_jwt=false).
 * Query: part=N (only when the catalog needs a sitemap index).
 *
 * Reads slugs from the public listing search index (ACTIVE listings only). Absolute
 * URLs use PUBLIC_GUEST_APP_ORIGIN for this deployment, never the request host.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { resolvePublicGuestAppOrigin } from '../_shared/publicAppOrigin.ts';
import {
  buildSitemapIndex,
  buildUrlset,
  listingPath,
  MAX_URLS_PER_SITEMAP,
  placePath,
  STATIC_SITEMAP_PATHS,
  type SitemapEntry,
  type SitemapFamily,
} from '../_shared/publicSitemap.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const PAGE = 1_000;

async function loadEntries(): Promise<SitemapEntry[]> {
  const supabase = createServiceClient();
  const entries: SitemapEntry[] = STATIC_SITEMAP_PATHS.map((path) => ({ path }));
  const places = new Set<string>();

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('public_listing_search')
      .select('family, id, slug, place_slug, refreshed_at')
      .order('family')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sitemap read failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const family = row.family as SitemapFamily;
      entries.push({ path: listingPath(family, row.slug as string), lastmod: row.refreshed_at as string });
      const placeKey = `${family}:${row.place_slug as string}`;
      if (!places.has(placeKey)) {
        places.add(placeKey);
        entries.push({ path: placePath(family, row.place_slug as string) });
      }
    }
    if (rows.length < PAGE) break;
  }
  return entries;
}

function xml(req: Request, body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

servePublic('public-sitemap', async (req) => {
  if (req.method !== 'GET') return xml(req, '', 405);
  const limited = await publicGetRateLimitGate(req, 'public-sitemap');
  if (limited) return limited;

  const origin = resolvePublicGuestAppOrigin();
  const entries = await loadEntries();
  const parts = Math.max(1, Math.ceil(entries.length / MAX_URLS_PER_SITEMAP));
  const partRaw = Number.parseInt(new URL(req.url).searchParams.get('part') ?? '', 10);

  if (parts > 1 && !Number.isFinite(partRaw)) {
    return xml(req, buildSitemapIndex(origin, parts));
  }
  const part = Number.isFinite(partRaw) ? partRaw : 1;
  if (part < 1 || part > parts) return xml(req, '', 404);
  const slice = entries.slice((part - 1) * MAX_URLS_PER_SITEMAP, part * MAX_URLS_PER_SITEMAP);
  return xml(req, buildUrlset(origin, slice));
});
