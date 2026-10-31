/**
 * sitemap.xml builder for the public guest site.
 *
 * URLs: static marketing pages, every ACTIVE property / development / parking detail page,
 * and every place browse page (`/{family}/in/:place`). Above MAX_URLS_PER_SITEMAP the root
 * becomes a sitemap index pointing at `?part=N` files (protocol limit is 50,000 URLs).
 */

export const MAX_URLS_PER_SITEMAP = 45_000;

export const STATIC_SITEMAP_PATHS = [
  '/',
  '/properties',
  '/developments',
  '/parkings',
  '/for-hosts',
  '/for-hosts/pricing',
  '/services',
  '/about',
  '/contact',
  '/support',
  '/terms',
  '/privacy',
  '/cookies',
] as const;

export type SitemapEntry = { path: string; lastmod?: string | null };

const FAMILY_PATH = {
  property: 'properties',
  development: 'developments',
  parking: 'parkings',
} as const;

export type SitemapFamily = keyof typeof FAMILY_PATH;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function listingPath(family: SitemapFamily, slug: string): string {
  return `/${FAMILY_PATH[family]}/${encodeURIComponent(slug)}`;
}

export function placePath(family: SitemapFamily, placeSlug: string): string {
  return `/${FAMILY_PATH[family]}/in/${encodeURIComponent(placeSlug)}`;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

export function buildUrlset(origin: string, entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const loc = `<loc>${escapeXml(`${origin}${entry.path}`)}</loc>`;
      const lastmod = isoDate(entry.lastmod);
      return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildSitemapIndex(origin: string, parts: number): string {
  const body = Array.from(
    { length: parts },
    (_, i) => `  <sitemap><loc>${escapeXml(`${origin}/sitemap.xml?part=${i + 1}`)}</loc></sitemap>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
