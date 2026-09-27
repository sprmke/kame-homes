import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { openPageBlocksFromResults } from './dashboardAssistantNavigationTools.ts';

Deno.test('openPageBlocksFromResults keeps successful open_page results, deduped', () => {
  const ok = (href: string) => ({
    toolName: 'open_page',
    ok: true,
    data: { routeKey: 'property.finance', label: 'Open finance', href },
  });
  const blocks = openPageBlocksFromResults([
    ok('/org/a/property/b/finance'),
    ok('/org/a/property/b/finance'),
    { toolName: 'open_page', ok: false, data: undefined },
    { toolName: 'get_booking', ok: true, data: { href: '/org/a' } },
  ]);
  assertEquals(blocks, [
    {
      type: 'open_page',
      routeKey: 'property.finance',
      label: 'Open finance',
      href: '/org/a/property/b/finance',
    },
  ]);
});

Deno.test('openPageBlocksFromResults rejects non-dashboard hrefs and caps at 3', () => {
  const make = (href: string) => ({
    toolName: 'open_page',
    ok: true,
    data: { routeKey: 'org.team', label: 'Open', href },
  });
  assertEquals(openPageBlocksFromResults([make('https://evil.test')]).length, 0);
  assertEquals(
    openPageBlocksFromResults([
      make('/org/a/team'),
      make('/org/a/plans'),
      make('/org/a/settings'),
      make('/org/a/analytics'),
    ]).length,
    3
  );
});
