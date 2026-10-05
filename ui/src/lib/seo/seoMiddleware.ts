/**
 * Request handling for the Vercel middleware (`ui/middleware.ts`): robots.txt,
 * sitemap.xml proxy, and crawler-ready HTML for listing detail pages so link previews
 * (Facebook, Messenger, WhatsApp, Slack, …) show the listing instead of the bare SPA shell.
 *
 * Every path fails open: any error or missing data returns `null`, and the middleware
 * passes the request through to the normal SPA response. No `@/` imports (bundled by
 * Vercel outside Vite).
 */

import {
  buildDevelopmentJsonLd,
  buildParkingJsonLd,
  buildPropertyJsonLd,
  buildRobotsTxt,
  DEFAULT_DESCRIPTION,
  injectMetaIntoHtml,
  isCrawlerUserAgent,
  matchListingDetailPath,
  type ListingFamily,
  type SeoMeta,
} from './seoMeta';

export type SeoMiddlewareDeps = {
  /** `VITE_SUPABASE_URL` — the functions base (…/functions/v1). */
  functionsUrl: string;
  anonKey: string;
  siteName: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 2_500;

type Json = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function getJson(url: string, deps: SeoMiddlewareDeps): Promise<Json | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(url, {
    headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}` },
    signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return (await res.json()) as Json;
}

function title(siteName: string, page: string): string {
  return siteName ? `${siteName} - ${page}` : page;
}

export async function loadListingMeta(
  family: ListingFamily,
  slug: string,
  canonicalUrl: string,
  deps: SeoMiddlewareDeps
): Promise<SeoMeta | null> {
  const base = deps.functionsUrl.replace(/\/+$/, '');
  const encoded = encodeURIComponent(slug);

  if (family === 'property') {
    const body = await getJson(`${base}/get-public-property?property=${encoded}`, deps);
    const data = (body?.data ?? null) as Json | null;
    const name = str(data?.name);
    if (!data || !name) return null;
    const images = Array.isArray(data.images)
      ? data.images.filter((x): x is string => !!str(x))
      : [];
    const location = str(data.locationLabel);
    const pricing = (data.pricing ?? {}) as Json;
    const description =
      str(data.description) ??
      (location ? `${name} in ${location}. Check dates and book online.` : DEFAULT_DESCRIPTION);
    return {
      title: title(deps.siteName, name),
      description,
      canonicalUrl,
      image: images[0] ?? null,
      jsonLd: buildPropertyJsonLd({
        name,
        url: canonicalUrl,
        description: str(data.description),
        images,
        address: { city: str(data.city), province: str(data.province), country: str(data.country) },
        rating: num(data.rating),
        reviewCount: num(data.reviewCount) ?? 0,
        priceFrom: num(pricing.weekdayNightlyRate),
      }),
    };
  }

  if (family === 'parking') {
    const body = await getJson(`${base}/get-public-parking?parking=${encoded}`, deps);
    const data = (body?.data ?? null) as Json | null;
    const name = str(data?.name);
    if (!data || !name) return null;
    const place = str(data.residenceName) ?? str(data.city);
    const description =
      str(data.description) ??
      (place ? `Parking at ${place}. Check dates and reserve online.` : DEFAULT_DESCRIPTION);
    return {
      title: title(deps.siteName, name),
      description,
      canonicalUrl,
      image: str(data.coverImage),
      jsonLd: buildParkingJsonLd({
        name,
        url: canonicalUrl,
        description: str(data.description),
        image: str(data.coverImage),
        address: { city: str(data.city), province: str(data.province), country: str(data.country) },
        priceFrom: num(data.ratePerNight),
      }),
    };
  }

  const body = await getJson(`${base}/list-public-developments?slug=${encoded}&pageSize=1`, deps);
  const rows = Array.isArray(body?.data) ? (body!.data as Json[]) : [];
  const data = rows[0];
  const name = str(data?.name);
  if (!data || !name) return null;
  const location = str(data.location) ?? str(data.city);
  return {
    title: title(deps.siteName, name),
    description:
      str(data.description) ??
      (location ? `${name} in ${location}. Browse homes and parking.` : DEFAULT_DESCRIPTION),
    canonicalUrl,
    image: str(data.coverImage),
    jsonLd: buildDevelopmentJsonLd({
      name,
      url: canonicalUrl,
      description: str(data.description),
      image: str(data.coverImage),
      city: str(data.city),
    }),
  };
}

/**
 * Returns a Response to send, or null to pass the request through unchanged.
 * `loadShell` fetches the built SPA index.html for this deployment.
 */
export async function handleSeoRequest(
  request: Request,
  deps: SeoMiddlewareDeps,
  loadShell: () => Promise<string | null>
): Promise<Response | null> {
  try {
    const url = new URL(request.url);

    if (url.pathname === '/robots.txt') {
      return new Response(buildRobotsTxt(url.origin), {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=86400',
        },
      });
    }

    if (url.pathname === '/sitemap.xml') {
      const doFetch = deps.fetchImpl ?? fetch;
      const res = await doFetch(
        `${deps.functionsUrl.replace(/\/+$/, '')}/public-sitemap${url.search}`,
        {
          headers: { apikey: deps.anonKey, Authorization: `Bearer ${deps.anonKey}` },
          signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS * 4),
        }
      );
      if (!res.ok) return null;
      return new Response(await res.text(), {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    if (request.method !== 'GET' || !isCrawlerUserAgent(request.headers.get('user-agent'))) {
      return null;
    }
    const match = matchListingDetailPath(url.pathname);
    if (!match) return null;

    const canonicalUrl = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    const [shell, meta] = await Promise.all([
      loadShell(),
      loadListingMeta(match.family, match.slug, canonicalUrl, deps),
    ]);
    if (!shell || !meta) return null;

    return new Response(injectMetaIntoHtml(shell, meta), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
        vary: 'user-agent',
      },
    });
  } catch {
    return null;
  }
}
