import { useEffect } from 'react';

import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  serializeJsonLd,
  truncateDescription,
} from '@/lib/seo/seoMeta';

export type PageMetaInput = {
  /** Plain description; truncated to ~160 characters. Omit for the site default. */
  description?: string | null;
  /** Path for the canonical URL (query string dropped). Defaults to the current path. */
  canonicalPath?: string;
  /** Absolute or root-relative image for link previews. */
  image?: string | null;
  /** Title for og:title / twitter:title (document.title stays with usePageTitle). */
  title?: string;
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
};

const MARKER = 'data-seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute(MARKER, '');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeOwned(selector: string): void {
  document.head.querySelectorAll(`${selector}[${MARKER}]`).forEach((el) => el.remove());
}

function absoluteUrl(value: string): string {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

/**
 * Description, canonical, Open Graph / Twitter, robots, and JSON-LD for public pages.
 * Crawlers that do not run JS get the same tags from the Vercel middleware for listing
 * detail pages; this hook keeps in-app navigation and JS-rendering crawlers in sync.
 */
export function usePageMeta(input: PageMetaInput, enabled = true): void {
  const { description, canonicalPath, image, title, jsonLd, noindex } = input;
  const jsonLdText = jsonLd ? serializeJsonLd(jsonLd) : null;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const text = truncateDescription(description?.trim() || DEFAULT_DESCRIPTION);
    const path = canonicalPath ?? window.location.pathname;
    const canonical = absoluteUrl(path.split('?')[0] ?? path);
    const ogTitle = title ?? document.title ?? SITE_NAME;

    upsertMeta('name', 'description', text);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:title', ogTitle);
    upsertMeta('property', 'og:description', text);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', ogTitle);
    upsertMeta('name', 'twitter:description', text);
    if (image) {
      upsertMeta('property', 'og:image', absoluteUrl(image));
      upsertMeta('name', 'twitter:image', absoluteUrl(image));
    } else {
      removeOwned('meta[property="og:image"]');
      removeOwned('meta[name="twitter:image"]');
    }

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      link.setAttribute(MARKER, '');
      document.head.appendChild(link);
    }
    link.href = canonical;

    if (noindex) upsertMeta('name', 'robots', 'noindex');
    else removeOwned('meta[name="robots"]');

    removeOwned('script[type="application/ld+json"]');
    if (jsonLdText) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(MARKER, '');
      script.textContent = jsonLdText;
      document.head.appendChild(script);
    }

    return () => {
      removeOwned('script[type="application/ld+json"]');
      removeOwned('meta[name="robots"]');
      removeOwned('meta[property="og:image"]');
      removeOwned('meta[name="twitter:image"]');
      upsertMeta('name', 'description', DEFAULT_DESCRIPTION);
    };
  }, [enabled, description, canonicalPath, image, title, jsonLdText, noindex]);
}
