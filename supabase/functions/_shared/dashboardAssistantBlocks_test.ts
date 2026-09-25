import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  isSafeInternalHref,
  knowledgeSourceLinks,
  sanitizeAssistantChatBlocks,
} from './dashboardAssistantBlocks.ts';

Deno.test('isSafeInternalHref — allows in-app paths', () => {
  assertEquals(isSafeInternalHref('/org/acme/property/unit-1/bookings'), true);
  assertEquals(
    isSafeInternalHref('/org/acme/property/unit-1/bookings?status=PENDING_REVIEW'),
    true
  );
});

Deno.test('isSafeInternalHref — rejects external, protocol-relative and script URLs', () => {
  for (const href of [
    'https://evil.example/login',
    '//evil.example/login',
    'javascript:alert(1)',
    '/\\evil.example',
    'org/acme',
    '',
    '/path\nwith-newline',
  ]) {
    assertEquals(isSafeInternalHref(href), false, href);
  }
});

Deno.test('sanitizeAssistantChatBlocks — drops unsafe links and empty link lists', () => {
  const blocks = sanitizeAssistantChatBlocks([
    {
      type: 'link_list',
      title: 'Open',
      links: [
        { label: 'Bookings', href: '/org/acme/property/unit-1/bookings' },
        { label: 'Verify account', href: 'https://phish.example' },
      ],
    },
    { type: 'link_list', title: 'Bad', links: [{ label: 'x', href: '//evil.example' }] },
  ]);
  assertEquals(blocks.length, 1);
  assertEquals(blocks[0], {
    type: 'link_list',
    title: 'Open',
    links: [{ label: 'Bookings', href: '/org/acme/property/unit-1/bookings' }],
  });
});

Deno.test('knowledgeSourceLinks — resolves route params and skips unresolvable routes', () => {
  const block = knowledgeSourceLinks(
    [
      {
        question: 'How do bookings work?',
        route_path: '/org/:orgSlug/property/:propertySlug/bookings',
      },
      { question: 'Duplicate', route_path: '/org/:orgSlug/property/:propertySlug/bookings' },
      { question: 'Parking page', route_path: '/org/:orgSlug/parking/:parkingSlug' },
      { question: 'Team', route_path: '/org/:orgSlug/team' },
      { question: 'External', route_path: 'https://evil.example' },
    ],
    { orgSlug: 'acme', propertySlug: 'unit-1' }
  );
  assertEquals(block, {
    type: 'link_list',
    title: 'Related pages',
    links: [
      { label: 'How do bookings work?', href: '/org/acme/property/unit-1/bookings' },
      { label: 'Team', href: '/org/acme/team' },
    ],
  });
});

Deno.test('knowledgeSourceLinks — returns null when nothing is linkable', () => {
  assertEquals(
    knowledgeSourceLinks([{ question: 'Q', route_path: null }], { orgSlug: 'acme' }),
    null
  );
});
