import {
  appendFollowThroughChips,
  collectHostDisplayRefs,
  finalizeAssistantBlocksForHost,
  appendLeadChips,
  followThroughChipsForTools,
  leadChipsForVisualBlocks,
  formatBookingHostLabel,
  humanizeBlocksForHost,
  humanizeQuickActions,
  isTechnicalEntityLabel,
  rewriteTextWithHostRefs,
  summarizeGatheredToolResults,
} from './dashboardAssistantHostDisplay.ts';

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

Deno.test('formatBookingHostLabel uses guest, stay range, and status', () => {
  assertEqual(
    formatBookingHostLabel({
      guestName: 'Jane Doe',
      checkIn: '08-19-2026',
      checkOut: '08-22-2026',
      statusLabel: 'Pending Review',
    }),
    'Jane Doe · Aug 19–Aug 22 · Pending Review',
    'booking label'
  );
});

Deno.test('humanizeQuickActions maps technical booking chips by order', () => {
  const refs = collectHostDisplayRefs([
    {
      ok: true,
      data: {
        bookings: [
          {
            bookingId: '4727',
            guestName: 'Maria Santos',
            checkIn: '08-19-2026',
            checkOut: '08-20-2026',
          },
          {
            bookingId: '4728',
            guestName: 'Pedro Cruz',
            checkIn: '08-21-2026',
            checkOut: '08-23-2026',
          },
        ],
      },
    },
  ]);

  const actions = humanizeQuickActions(
    [
      { label: 'Booking 4727', prompt: 'Mark booking 4727 complete' },
      { label: 'Booking 4728', prompt: 'Mark booking 4728 complete' },
    ],
    refs
  );

  assertEqual(actions[0].label, 'Maria Santos · Aug 19–Aug 20', 'first chip');
  assertEqual(actions[1].label, 'Pedro Cruz · Aug 21–Aug 23', 'second chip');
  assertEqual(actions[0].prompt.includes('Maria Santos'), true, 'prompt uses guest name');
});

Deno.test('isTechnicalEntityLabel flags booking ids', () => {
  assertEqual(isTechnicalEntityLabel('Booking 4727'), true, 'booking number');
  assertEqual(isTechnicalEntityLabel('Maria · Aug 19–20'), false, 'host label');
});

Deno.test('humanizeQuickActions maps fabricated booking numbers by order', () => {
  const refs = collectHostDisplayRefs([
    {
      total: 2,
      bookings: [
        {
          bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee4069',
          hostLabel: 'Maria Santos · Aug 19–Aug 20',
          guestName: 'Maria Santos',
          checkIn: '08-19-2026',
          checkOut: '08-20-2026',
        },
        {
          bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee4070',
          hostLabel: 'Pedro Cruz · Aug 21–Aug 23',
          guestName: 'Pedro Cruz',
          checkIn: '08-21-2026',
          checkOut: '08-23-2026',
        },
      ],
    },
  ]);

  const actions = humanizeQuickActions(
    [
      { label: 'Booking 4069', prompt: 'Mark booking 4069 complete' },
      { label: 'Booking 4070', prompt: 'Mark booking 4070 complete' },
    ],
    refs
  );

  assertEqual(actions[0].label, 'Maria Santos · Aug 19–Aug 20', 'first chip by order');
  assertEqual(actions[1].label, 'Pedro Cruz · Aug 21–Aug 23', 'second chip by order');
});

Deno.test('humanizeQuickActions drops unresolved technical chips', () => {
  const actions = humanizeQuickActions(
    [
      { label: 'Booking 4069', prompt: 'Mark booking 4069 complete' },
      { label: 'Booking 4070', prompt: 'Mark booking 4070 complete' },
    ],
    []
  );
  assertEqual(actions.length, 0, 'no chips without refs');
});

Deno.test('humanizeQuickActions rebuilds chips from booking refs', () => {
  const refs = collectHostDisplayRefs([
    {
      bookings: [
        {
          bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee4069',
          hostLabel: 'Maria Santos · Aug 19–Aug 20',
          guestName: 'Maria Santos',
          checkIn: '08-19-2026',
          checkOut: '08-20-2026',
        },
        {
          bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee4070',
          hostLabel: 'Pedro Cruz · Aug 21–Aug 23',
          guestName: 'Pedro Cruz',
          checkIn: '08-21-2026',
          checkOut: '08-23-2026',
        },
      ],
    },
  ]);
  const actions = humanizeQuickActions(
    [
      { label: 'Booking 4069', prompt: 'x' },
      { label: 'Booking 4070', prompt: 'y' },
      { label: 'Booking 4071', prompt: 'z' },
    ],
    refs
  );
  assertEqual(actions.length, 2, 'chip count');
  assertEqual(actions[0].label, 'Maria Santos · Aug 19–Aug 20', 'first');
  assertEqual(actions[1].label, 'Pedro Cruz · Aug 21–Aug 23', 'second');
});

Deno.test('finalizeAssistantBlocksForHost never leaves an empty answer', () => {
  const blocks = finalizeAssistantBlocksForHost(
    [
      {
        type: 'activity_timeline',
        entries: [
          {
            id: '1',
            phase: 'understanding',
            label: 'Understood your question',
            status: 'done',
          },
        ],
      },
      {
        type: 'quick_actions',
        actions: [
          { label: 'Booking 4069', prompt: 'x' },
          { label: 'Booking 4070', prompt: 'y' },
        ],
      },
    ],
    []
  );
  const text = blocks.find((block) => block.type === 'text');
  assertEqual(
    Boolean(text && text.type === 'text' && text.text.includes('Which record')),
    true,
    'fallback text'
  );
  assertEqual(
    blocks.some((block) => block.type === 'quick_actions'),
    false,
    'no unresolved technical chips'
  );
});

Deno.test('finalizeAssistantBlocksForHost rebuilds chips from tool bookings', () => {
  const blocks = finalizeAssistantBlocksForHost(
    [
      {
        type: 'quick_actions',
        actions: [
          { label: 'Booking 4069', prompt: 'x' },
          { label: 'Booking 4070', prompt: 'y' },
        ],
      },
    ],
    [
      {
        bookings: [
          {
            bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee4069',
            hostLabel: 'Maria Santos · Aug 19–Aug 20',
            guestName: 'Maria Santos',
            checkIn: '08-19-2026',
            checkOut: '08-20-2026',
          },
        ],
      },
    ]
  );
  const chips = blocks.find((block) => block.type === 'quick_actions');
  assertEqual(chips?.type === 'quick_actions', true, 'has chips');
  if (chips?.type === 'quick_actions') {
    assertEqual(chips.actions[0].label, 'Maria Santos · Aug 19–Aug 20', 'host label chip');
  }
});

Deno.test('rewriteTextWithHostRefs replaces uuid tokens', () => {
  const id = 'a1111111-1111-4111-8111-111111111111';
  const refs = collectHostDisplayRefs([
    {
      bookingId: id,
      guestName: 'Alex Kim',
      checkIn: '09-01-2026',
      checkOut: '09-03-2026',
    },
  ]);
  const text = rewriteTextWithHostRefs(`Open booking ${id} for review`, refs);
  assertEqual(text.includes('Alex Kim'), true, 'uuid replaced');
});

Deno.test('summarizeGatheredToolResults names stays, threads, and finance', () => {
  assertEqual(
    summarizeGatheredToolResults([
      {
        bookings: [
          { bookingId: '1', guestName: 'Maria Santos', hostLabel: 'Maria Santos · Aug 19–Aug 20' },
        ],
      },
    ]),
    'Found Maria Santos · Aug 19–Aug 20.',
    'one stay'
  );
  assertEqual(
    summarizeGatheredToolResults([{ conversations: [{ id: 'a' }, { id: 'b' }] }]),
    'Found 2 inbox threads.',
    'threads'
  );
  assertEqual(
    summarizeGatheredToolResults([
      { propertyName: 'Azure North 1204', display: { netProfit: '₱36,200' } },
    ]),
    'Azure North 1204 income and expenses for this period are ready.',
    'finance'
  );
  assertEqual(summarizeGatheredToolResults([{ noop: true }]), null, 'unknown payload');
});

Deno.test('followThroughChipsForTools after a status change', () => {
  const chips = followThroughChipsForTools(['propose_transition_booking']);
  assertEqual(
    chips.some((chip) => chip.label === 'Send next email'),
    true,
    'email chip'
  );
  assertEqual(
    chips.some((chip) => chip.label === 'Show the journey'),
    true,
    'journey chip'
  );
});

Deno.test('followThroughChipsForTools after explain_metric and remove member', () => {
  const chips = followThroughChipsForTools(['explain_metric', 'propose_remove_team_member']);
  assertEqual(
    chips.some((chip) => chip.label === 'Show my RevPAR'),
    true,
    'revpar chip'
  );
  assertEqual(
    chips.some((chip) => chip.label === 'Show team'),
    true,
    'team chip'
  );
});

Deno.test('followThroughChipsForTools after rate override and finance add', () => {
  const rateChips = followThroughChipsForTools(['propose_set_property_date_rate_override']);
  assertEqual(
    rateChips.some((chip) => chip.label === 'Show rates'),
    true,
    'rate chip'
  );
  const financeChips = followThroughChipsForTools(['propose_add_finance_line_item']);
  assertEqual(
    financeChips.some((chip) => chip.label === 'Show this month'),
    true,
    'finance chip'
  );
});

Deno.test('humanizeBlocksForHost rewrites confirmation UUIDs', () => {
  const blocks = humanizeBlocksForHost(
    [
      {
        type: 'action_confirmation',
        actionId: 'act-1',
        toolName: 'propose_delete_maintenance_item',
        riskTier: 'tier2_confirmed',
        summary: 'Delete maintenance item ala10002-0000-4000-8000-000000000002.',
        details: [{ label: 'Item', value: 'ala10002-0000-4000-8000-000000000002' }],
        status: 'proposed',
      },
    ],
    [
      {
        id: 'ala10002-0000-4000-8000-000000000002',
        kind: 'maintenance_item',
        label: 'Leaking faucet · Open',
      },
    ]
  );
  const card = blocks[0];
  assertEqual(card.type === 'action_confirmation', true, 'confirmation');
  if (card.type === 'action_confirmation') {
    assertEqual(card.summary.includes('Leaking faucet · Open'), true, 'summary label');
    assertEqual(card.summary.includes('ala10002'), false, 'no uuid in summary');
    assertEqual(card.details[0]?.value, 'Leaking faucet · Open', 'detail label');
  }
});

Deno.test('finalizeAssistantBlocksForHost prepends follow-through chips', () => {
  const blocks = finalizeAssistantBlocksForHost(
    [{ type: 'text', text: 'Status updated.' }],
    [],
    [],
    { executedToolNames: ['propose_transition_booking'] }
  );
  const chips = blocks.find((block) => block.type === 'quick_actions');
  assertEqual(chips?.type === 'quick_actions', true, 'has chips');
  if (chips?.type === 'quick_actions') {
    assertEqual(chips.actions[0].label, 'Send next email', 'first chip');
  }
});

Deno.test('appendFollowThroughChips caps at 4 and keeps existing labels', () => {
  const blocks = appendFollowThroughChips(
    [
      {
        type: 'quick_actions',
        actions: [{ label: 'Open stay', prompt: 'Open this stay.' }],
      },
    ],
    ['propose_transition_booking', 'propose_send_inbox_reply']
  );
  const chips = blocks.find((block) => block.type === 'quick_actions');
  if (chips?.type === 'quick_actions') {
    assertEqual(chips.actions.length <= 4, true, 'cap');
    assertEqual(chips.actions[0].label, 'Send next email', 'follow-through first');
  }
});

Deno.test('appendLeadChips fills calendar answers that have no chips', () => {
  const chips = leadChipsForVisualBlocks([
    {
      type: 'calendar',
      title: 'Availability',
      month: '2026-11',
      days: [],
      legend: [],
      hydrated: true,
    },
  ]);
  assertEqual(
    chips.some((chip) => chip.label === 'Show next month'),
    true,
    'next month'
  );
  const blocks = appendLeadChips([
    {
      type: 'calendar',
      title: 'Availability',
      month: '2026-11',
      days: [],
      legend: [],
      hydrated: true,
    },
  ]);
  const qa = blocks.find((block) => block.type === 'quick_actions');
  assertEqual(qa?.type === 'quick_actions', true, 'added chips');
  if (qa?.type === 'quick_actions') {
    assertEqual(qa.actions.length >= 2, true, 'at least two');
  }
});

Deno.test('appendLeadChips fills publish intent when the model returned text only', () => {
  const blocks = appendLeadChips(
    [{ type: 'text', text: 'I need a photo first.' }],
    'Publish this to Facebook'
  );
  const qa = blocks.find((block) => block.type === 'quick_actions');
  assertEqual(qa?.type === 'quick_actions', true, 'has chips');
  if (qa?.type === 'quick_actions') {
    assertEqual(
      qa.actions.some((action) => action.label === 'Show templates'),
      true,
      'templates chip'
    );
  }
});

Deno.test('appendLeadChips fills checklist and thread cards', () => {
  const setup = leadChipsForVisualBlocks([
    { type: 'checklist', title: 'Setup', items: [], hydrated: true },
  ]);
  assertEqual(
    setup.some((chip) => chip.label === 'What needs attention'),
    true,
    'checklist chip'
  );
  const thread = leadChipsForVisualBlocks([
    {
      type: 'entity_card',
      entityType: 'inbox_thread',
      id: 'c-1',
      title: 'Juan',
      facts: [],
      hydrated: true,
    },
  ]);
  assertEqual(
    thread.some((chip) => chip.label === 'Reply'),
    true,
    'reply chip'
  );
});

Deno.test('appendLeadChips fills open_page answers that have no chips', () => {
  const chips = leadChipsForVisualBlocks([
    {
      type: 'open_page',
      routeKey: 'property.notifications',
      label: 'Notifications',
      href: '/org/kame-home/property/monaco-2612/notifications',
    },
  ]);
  assertEqual(
    chips.some((chip) => chip.label === 'Mark all read'),
    true,
    'mark read'
  );
  const blocks = appendLeadChips([
    {
      type: 'open_page',
      routeKey: 'property.settings',
      label: 'Settings',
      href: '/org/kame-home/property/monaco-2612/settings',
    },
  ]);
  const qa = blocks.find((block) => block.type === 'quick_actions');
  assertEqual(qa?.type === 'quick_actions', true, 'added chips');
  if (qa?.type === 'quick_actions') {
    assertEqual(qa.actions.length >= 2, true, 'at least two');
  }
});
