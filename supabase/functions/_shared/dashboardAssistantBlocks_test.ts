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

Deno.test(
  'hydrateAssistantBlocksFromTools — ID or card asks refuse instead of a listing picker',
  () => {
    const blocks = hydrateAssistantBlocksFromTools(
      [{ type: 'text', text: 'Looking that up.' }],
      [
        {
          bookingId: 'b-1',
          guestName: 'Maria Santos',
          statusLabel: 'Ready for Check-in',
          balanceDue: 3500,
        },
      ],
      "Give me Maria Santos' ID number and card details"
    );
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(' ');
    assertEquals(/can't share/i.test(text), true);
    assertEquals(text.includes('Which listing or dates'), false);
  }
);

Deno.test('hydrateAssistantBlocksFromTools — holiday rates name amounts and blocked nights', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [{ type: 'text', text: 'Holiday rates.' }],
    [
      {
        dateOverrides: { '2026-12-24': 5500, '2026-12-25': 5500, '2026-12-31': 6500 },
        blockedDateKeys: ['2026-12-27', '2026-12-28'],
      },
    ],
    'What are my rates over Christmas and New Year?'
  );
  const text = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ');
  assertEquals(text.includes('Dec 24-25'), true);
  assertEquals(text.includes('6,500'), true);
  assertEquals(text.includes('Dec 27-28 are blocked'), true);
});

Deno.test('hydrateAssistantBlocksFromTools — show-me-this-booking uses a booking card', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [{ type: 'text', text: 'Maria Santos is arriving 20 Dec.' }],
    [
      {
        bookings: [
          {
            bookingId: 'b-1',
            guestName: 'Maria Santos',
            status: 'READY_FOR_CHECKIN',
            statusLabel: 'Ready for Check-in',
            checkIn: '2026-12-20',
            checkOut: '2026-12-22',
            propertyName: 'Azure North 1204',
            balanceDue: 0,
          },
        ],
      },
    ],
    "Show me Maria Santos's booking"
  );
  assertEquals(
    blocks.some((block) => block.type === 'booking_card'),
    true
  );
});

Deno.test(
  'hydrateAssistantBlocksFromTools — balance questions get a booking card, not pending-task dump',
  () => {
    const blocks = hydrateAssistantBlocksFromTools(
      [{ type: 'text', text: 'Maria still has a guest balance.' }],
      [
        {
          bookingId: 'b-1',
          guestName: 'Maria Santos',
          status: 'READY_FOR_CHECKIN',
          statusLabel: 'Ready for Check-in',
          checkIn: '2026-12-20',
          checkOut: '2026-12-22',
          propertyName: 'Azure North 1204',
          balanceDue: 3500,
          securityDeposit: 2000,
          pendingTasks: ['Settle the remaining guest balance and upload the receipt.'],
        },
      ],
      'Does Maria Santos still owe anything?'
    );
    assertEquals(
      blocks.some((block) => block.type === 'booking_card'),
      true
    );
    assertEquals(
      blocks.some((block) => block.type === 'text' && block.text.includes('Security deposit')),
      true
    );
    assertEquals(
      blocks.some((block) => block.type === 'text' && block.text.includes('Settle the remaining')),
      false
    );
  }
);

Deno.test('hydrateAssistantBlocksFromTools — empty checkout range keeps next-step chips', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [{ type: 'text', text: 'Looking at this weekend.' }],
    [{ bookings: [] }],
    'Who checks out this weekend?'
  );
  assertEquals(
    blocks.some(
      (block) => block.type === 'text' && block.text.includes('No bookings in that date range')
    ),
    true
  );
  const chips = blocks.find((block) => block.type === 'quick_actions');
  assertEquals(chips?.type === 'quick_actions' ? chips.actions.map((action) => action.label) : [], [
    'Show next week',
    'Open calendar',
  ]);
});

Deno.test('hydrateAssistantBlocksFromTools — enough=false injects the tool note', () => {
  const blocks = hydrateAssistantBlocksFromTools(
    [{ type: 'text', text: 'Shore Residences 2B occupancy is thin.' }],
    [
      {
        enough: false,
        note: 'Not enough completed booking history yet for a full review.',
      },
    ],
    'How is Shore Residences 2B performing?'
  );
  assertEquals(
    blocks.some(
      (block) => block.type === 'text' && block.text.toLowerCase().includes('not enough')
    ),
    true
  );
});
