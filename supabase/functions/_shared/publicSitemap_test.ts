import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  buildSitemapIndex,
  buildUrlset,
  escapeXml,
  listingPath,
  placePath,
} from './publicSitemap.ts';

Deno.test('escapeXml escapes markup characters', () => {
  assertEquals(escapeXml(`a&b<c>"d'`), 'a&amp;b&lt;c&gt;&quot;d&apos;');
});

Deno.test('paths encode slugs', () => {
  assertEquals(listingPath('property', 'azure-1'), '/properties/azure-1');
  assertEquals(placePath('parking', 'las piñas'), '/parkings/in/las%20pi%C3%B1as');
});

Deno.test('buildUrlset emits absolute locs and ISO lastmod dates', () => {
  const xml = buildUrlset('https://example.com', [
    { path: '/', lastmod: null },
    { path: '/properties/a', lastmod: '2026-08-05T10:00:00+00:00' },
    { path: '/x?y=1&z=2', lastmod: 'garbage' },
  ]);
  assertStringIncludes(xml, '<loc>https://example.com/</loc></url>');
  assertStringIncludes(xml, '<lastmod>2026-08-05</lastmod>');
  assertStringIncludes(xml, 'https://example.com/x?y=1&amp;z=2</loc></url>');
});

Deno.test('buildSitemapIndex lists numbered parts', () => {
  const xml = buildSitemapIndex('https://example.com', 2);
  assertStringIncludes(xml, '<sitemapindex');
  assertStringIncludes(xml, 'sitemap.xml?part=2');
});
