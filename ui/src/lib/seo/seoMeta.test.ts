import { describe, expect, it } from 'vitest';

import {
  buildPropertyJsonLd,
  buildRobotsTxt,
  injectMetaIntoHtml,
  isCrawlerUserAgent,
  matchListingDetailPath,
  serializeJsonLd,
  truncateDescription,
} from '@/lib/seo/seoMeta';

describe('matchListingDetailPath', () => {
  it('matches detail routes only', () => {
    expect(matchListingDetailPath('/properties/monaco-2612')).toEqual({
      family: 'property',
      slug: 'monaco-2612',
    });
    expect(matchListingDetailPath('/parkings/slot-a1/')).toEqual({
      family: 'parking',
      slug: 'slot-a1',
    });
    expect(matchListingDetailPath('/developments/azure-north')?.family).toBe('development');
    expect(matchListingDetailPath('/properties/in/makati')).toBeNull();
    expect(matchListingDetailPath('/parkings/requests/abc')).toBeNull();
    expect(matchListingDetailPath('/developments/azure/properties')).toBeNull();
    expect(matchListingDetailPath('/properties/Bad_Slug')).toBeNull();
    expect(matchListingDetailPath('/org/x/property/y')).toBeNull();
  });
});

describe('isCrawlerUserAgent', () => {
  it('detects link preview and search crawlers', () => {
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isCrawlerUserAgent('WhatsApp/2.23')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (iPhone) Safari/604.1')).toBe(false);
    expect(isCrawlerUserAgent(null)).toBe(false);
  });
});

describe('injectMetaIntoHtml', () => {
  const shell =
    '<html><head><title>Kame Homes</title><meta name="description" content="old" /></head><body></body></html>';

  it('replaces title + description and escapes values', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 'Condo <b>"x"</b>',
      description: 'Nice & quiet',
      canonicalUrl: 'https://example.com/properties/a',
      image: 'https://img.example.com/a.jpg',
      jsonLd: { name: '</script><script>alert(1)</script>' },
    });
    expect(html).toContain('<title>Condo &lt;b&gt;&quot;x&quot;&lt;/b&gt;</title>');
    expect(html).not.toContain('content="old"');
    expect(html).toContain('content="Nice &amp; quiet"');
    expect(html).toContain('og:image');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html.match(/<title>/g)?.length).toBe(1);
  });

  it('truncates long descriptions in tags', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 't',
      description: 'long '.repeat(100),
      canonicalUrl: 'https://example.com/',
    });
    const content = html.match(/name="description" content="([^"]*)"/)?.[1] ?? '';
    expect(content.length).toBeLessThanOrEqual(160);
  });

  it('returns the input when there is no head', () => {
    expect(
      injectMetaIntoHtml('<p>x</p>', { title: 't', description: 'd', canonicalUrl: 'u' })
    ).toBe('<p>x</p>');
  });
});

describe('helpers', () => {
  it('truncates long descriptions on a word boundary', () => {
    const out = truncateDescription('word '.repeat(80));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });

  it('builds property JSON-LD without exact address and only rates with reviews', () => {
    const ld = buildPropertyJsonLd({
      name: 'Monaco 2612',
      url: 'https://example.com/properties/monaco-2612',
      images: ['a', 'b'],
      address: { city: 'San Fernando', province: 'Pampanga', country: 'Philippines' },
      rating: 4.8,
      reviewCount: 0,
    });
    expect(ld.aggregateRating).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain('streetAddress');
    expect(serializeJsonLd({ a: '<' })).toBe('{"a":"\\u003c"}');
  });

  it('robots.txt points at the sitemap and blocks private areas', () => {
    const txt = buildRobotsTxt('https://example.com');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(txt).toContain('Disallow: /org/');
    expect(txt).toContain('Disallow: /account');
  });
});

describe('robots trip pages', () => {
  it('keeps per-booking trip pages out of search', () => {
    expect(buildRobotsTxt('https://kamehomes.space')).toContain('Disallow: /*/trip?');
  });
});
