/**
 * Vercel Routing Middleware (project root = ui/). Narrow matcher, fail-open:
 * - /robots.txt and /sitemap.xml (proxied from the `public-sitemap` edge function)
 * - listing detail pages, only for crawler user agents, get server-rendered meta tags
 *   (title, description, Open Graph, JSON-LD) so link previews work without JS.
 * Everything else, and any error, continues to the normal SPA response.
 * Logic + tests: src/lib/seo/seoMiddleware.ts.
 */

import { next } from '@vercel/functions';

import { handleSeoRequest } from './src/lib/seo/seoMiddleware';

// Vercel runs Routing Middleware on Node; only env reads are needed here.
declare const process: { env: Record<string, string | undefined> };

export const config = {
  matcher: [
    '/robots.txt',
    '/sitemap.xml',
    '/properties/:slug',
    '/parkings/:slug',
    '/developments/:slug',
  ],
};

export default async function middleware(request: Request): Promise<Response> {
  const functionsUrl = process.env.VITE_SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!functionsUrl || !anonKey) return next();

  const response = await handleSeoRequest(
    request,
    {
      functionsUrl,
      anonKey,
      siteName: process.env.VITE_PLATFORM_APP_NAME?.trim() || 'Kame Homes',
    },
    async () => {
      const res = await fetch(new URL('/index.html', request.url), {
        signal: AbortSignal.timeout(2_500),
      });
      return res.ok ? res.text() : null;
    }
  );
  return response ?? next();
}
