import { FORMER_PLATFORM_APP_NAME, PLATFORM_APP_NAME } from '@/lib/platformBranding';

/**
 * Site-wide `Organization` structured data.
 *
 * Injected at runtime instead of living in `ui/index.html` because the CSP is
 * hash-free and `check-csp-theme-hash.sh` forbids inline script bodies there.
 * It also keeps the name env-driven instead of hardcoding it in the shell.
 *
 * `alternateName` keeps the former product name discoverable for search engines
 * for 6-12 months after the rename.
 */
export function installOrganizationJsonLd(doc: Document = document): void {
  if (doc.querySelector('script[data-organization-jsonld]')) return;

  const origin = doc.defaultView?.location.origin;
  if (!origin) return;

  const script = doc.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.organizationJsonld = 'true';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: PLATFORM_APP_NAME,
    alternateName: FORMER_PLATFORM_APP_NAME,
    url: origin,
    logo: `${origin}/images/logo.png`,
  });

  doc.head.appendChild(script);
}
