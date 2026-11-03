/**
 * Preview vs production hostname detection for analytics and error reporting.
 * dev.* subdomains and Vercel previews are preview; apex prod hosts are production.
 */

const PREVIEW_HOST_SUFFIXES = ['dev.kamespace.com'] as const;

export function isPreviewHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host.endsWith('.vercel.app')) return true;
  return PREVIEW_HOST_SUFFIXES.some((suffix) => host === suffix);
}

export function isProductionWebHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host || isPreviewHost(host)) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  return (
    host === 'kamespace.com' ||
    host === 'www.kamespace.com' ||
    host === 'kamehomes.space' ||
    host === 'www.kamehomes.space' ||
    host === 'app.kamehomes.space'
  );
}
