import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  hydrateAssistantBlocksFromTools,
  isSafeInternalHref,
  knowledgeSourceLinks,
  sanitizeAssistantChatBlocks,
} from './dashboardAssistantBlocks.ts';
import type { ChatBlock } from './dashboardAssistantSafetyGuard.ts';

const LISTED = {
  total: 3,
  bookings: [
    {
      bookingId: 'b-1',
      guestName: 'Mark O. Vale',
      checkIn: '2026-08-18',
      checkOut: '2026-08-20',
      status: 'PENDING_REVIEW',
      propertyId: 'p-1',
    },
    {
      bookingId: 'b-2',
      guestName: 'Mia C. Uy',
      checkIn: '2026-08-14',
      checkOut: '2026-08-16',
      status: 'PENDING_REVIEW',
      propertyId: 'p-2',
    },
    {
      bookingId: 'b-3',
      guestName: 'Mark O. Vale',
      checkIn: '2026-09-12',
      checkOut: '2026-09-15',
      status: 'PENDING_REVIEW',
      propertyId: 'p-1',
    },
  ],
};

function tableOf(blocks: ChatBlock[]) {
  const table = blocks.find((b) => b.type === 'data_table');
  if (!table || table.type !== 'data_table') throw new Error('no data_table');
  return table;
}

Deno.test(
  'hydrateAssistantBlocksFromTools — links table rows to bookings, repeat guests by date',
  () => {
    const blocks = hydrateAssistantBlocksFromTools(
      [
        {
          type: 'data_table',
          title: '',
          columns: ['Guest', 'Dates', 'Status'],
          rows: [
            { Guest: 'Mia C. Uy', Dates: 'Aug 14–Aug 16', Status: 'Pending Review' },
            { Guest: 'Mark O. Vale', Dates: 'Sep 12–Sep 15', Status: 'Pending Review' },
            { Guest: 'Mark O. Vale', Dates: 'Aug 18–Aug 20', Status: 'Pending Review' },
            { Guest: 'Someone Else', Dates: 'Oct 1–Oct 2', Status: 'Pending Review' },
          ],
        },
      ],
      [LISTED]
    );
    assertEquals(tableOf(blocks).rowTargets, [
      { bookingId: 'b-2', propertyId: 'p-2' },
      { bookingId: 'b-3', propertyId: 'p-1' },
      { bookingId: 'b-1', propertyId: 'p-1' },
      null,
    ]);
  }
);

Deno.test('hydrateAssistantBlocksFromTools — replaces model-written row targets', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [
      {
        type: 'data_table',
        title: '',
        columns: ['Guest', 'Dates'],
        rows: [{ Guest: 'Nobody', Dates: 'Aug 1' }],
        rowTargets: [{ bookingId: 'forged', propertyId: 'p-9' }],
      },
    ],
    [LISTED]
  );
  assertEquals(tableOf(blocks).rowTargets, undefined);
});

Deno.test('hydrateAssistantBlocksFromTools — fallback bookings table carries row targets', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [{ type: 'text', text: 'Here you go.' }],
    [LISTED]
  );
  assertEquals(
    tableOf(blocks).rowTargets?.map((t) => t?.bookingId),
    ['b-1', 'b-2', 'b-3']
  );
});

Deno.test('sanitizeAssistantChatBlocks — keeps row targets aligned when empty rows drop', () => {
  const [table] = sanitizeAssistantChatBlocks([
    {
      type: 'data_table',
      title: '',
      columns: ['Guest'],
      rows: [{ Guest: '' }, { Guest: 'Mia C. Uy' }],
      rowTargets: [
        { bookingId: 'b-1', propertyId: 'p-1' },
        { bookingId: 'b-2', propertyId: 'p-2' },
      ],
    },
  ]);
  assertEquals(table.type === 'data_table' ? table.rowTargets : null, [
    { bookingId: 'b-2', propertyId: 'p-2' },
  ]);
});

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
