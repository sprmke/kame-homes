import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  calendarFromAvailability,
  calendarFromPricing,
  chartFromDemographics,
  chartFromFinanceSummary,
  chartFromFinanceTrend,
  chartFromOccupancyTrend,
  checklistFromAttention,
  checklistFromPendingTasks,
  checklistFromSetupGuide,
  checklistFromSuperhost,
  comparisonFromBenchmark,
  comparisonFromListings,
  comparisonFromProposalPayload,
  comparisonFromWeekdayWeekend,
  checklistFromPlaybook,
  calloutFromEmptyActivity,
  calloutFromMetricExplanation,
  comparisonFromFinancePeriods,
  comparisonFromFinanceTrendQuarters,
  kpiFromPlanSnapshot,
  tableFromUnpricedHolidays,
  timelineFromMaintenance,
  entityCardsFromListResult,
  hydrateVisualBlocks,
  kpiFromAnalytics,
  kpiFromFinanceSummary,
  tableFromActivityLog,
  tableFromTeamMembers,
  timelineFromActivityLog,
  timelineFromBookingHistory,
} from './dashboardAssistantVisuals.ts';

Deno.test('calendarFromAvailability title includes open nights', () => {
  const cal = calendarFromAvailability({
    propertyName: 'Azure North 1204',
    from: '2027-02-01',
    to: '2027-02-28',
    bookedStays: [],
    availableRanges: [{ start: '2027-02-01', end: '2027-02-28' }],
    availableNightCount: 28,
  });
  assertEquals(cal?.title.includes('28 open nights'), true);
});

Deno.test('hydrateVisualBlocks injects a calendar for still-open date questions', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'December still has gaps.' }],
    [
      {
        propertyName: 'Azure North 1204',
        from: '2026-12-01',
        to: '2026-12-31',
        bookedStays: [],
        availableRanges: [{ start: '2026-12-01', end: '2026-12-19' }],
        availableNightCount: 26,
      },
    ],
    'Which dates are still open in December?'
  );
  assertEquals(
    out.some((block) => block.type === 'calendar'),
    true
  );
});

Deno.test('calendarFromAvailability marks booked nights and open ranges', () => {
  const cal = calendarFromAvailability({
    propertyName: 'Azure North 1204',
    from: '2026-12-01',
    to: '2026-12-31',
    bookedStays: [
      {
        guestName: 'Maria Santos',
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
      },
    ],
    availableRanges: [{ start: '2026-12-01', end: '2026-12-19' }],
  });
  assertEquals(cal?.type, 'calendar');
  assertEquals(cal?.month, '2026-12');
  const checkin = cal?.days.find((day) => day.date === '2026-12-20');
  assertEquals(checkin?.state, 'checkin');
  const open = cal?.days.find((day) => day.date === '2026-12-01');
  assertEquals(open?.state, 'available');
});

Deno.test('chartFromFinanceSummary uses category amounts', () => {
  const chart = chartFromFinanceSummary({
    operating: { byCategory: [{ label: 'Cleaning', amount: 6000 }] },
  });
  assertEquals(chart?.kind, 'donut');
  assertEquals(chart?.series[0]?.points[0]?.x, 'Cleaning');
});

Deno.test('chartFromFinanceTrend needs two months', () => {
  assertEquals(chartFromFinanceTrend({ months: [{ label: 'Oct', income: 1 }] }), null);
  const chart = chartFromFinanceTrend({
    months: [
      { label: 'May', income: 31000 },
      { label: 'Oct', income: 48500 },
    ],
  });
  assertEquals(chart?.kind, 'line');
  assertEquals(chart?.title, 'Income trend');
  assertEquals(chart?.series[0]?.points.length, 2);
});

Deno.test('chartFromFinanceTrend plots expenses when every month has them', () => {
  const chart = chartFromFinanceTrend({
    months: [
      { label: 'May', income: 31000, expenses: 9800 },
      { label: 'Oct', income: 48500, expenses: 12300 },
    ],
  });
  assertEquals(chart?.title, 'Income vs expenses');
  assertEquals(chart?.series.length, 2);
  assertEquals(chart?.series[1]?.points[1]?.y, 12300);
});

Deno.test('kpiFromAnalytics formats occupancy and finance', () => {
  const occ = kpiFromAnalytics({
    kpis: { occupancyRatePct: 68, occupancyRateVsPrior: '+6.0%' },
  });
  assertEquals(occ?.value, '68%');
  const profit = kpiFromAnalytics({ display: { netProfit: '₱36,200' } });
  assertEquals(profit?.value, '₱36,200');
});

Deno.test('comparisonFromProposalPayload reads smartTotal and firstChanges', () => {
  const cmp = comparisonFromProposalPayload({
    next30: { nights: 30, currentTotal: 90470, smartTotal: 85143 },
    firstChanges: [{ date: '2026-10-20', current: 3200, recommended: 2900 }],
  });
  assertEquals(cmp?.rows[0]?.after.includes('₱85,143'), true);
  assertEquals(cmp?.rows[1]?.after.includes('₱2,900'), true);
});

Deno.test('chartFromOccupancyTrend ignores trend rows without occupancy', () => {
  const chart = chartFromOccupancyTrend({
    trend: [
      { month: '2026-07' },
      { month: '2026-08' },
      { month: '2026-09', occupancyRatePct: 61 },
      { month: '2026-10', occupancyRatePct: 70 },
    ],
  });
  assertEquals(chart?.series[0]?.points.length, 2);
  assertEquals(
    chartFromOccupancyTrend({ trend: [{ month: '2026-07' }, { month: '2026-08' }] }),
    null
  );
  assertEquals(
    chartFromOccupancyTrend({
      trend: [
        { month: '2026-05', occupancyRatePct: 0 },
        { month: '2026-06', occupancyRatePct: 0 },
      ],
    }),
    null
  );
});

Deno.test('comparisonFromProposalPayload uses listing names', () => {
  const cmp = comparisonFromProposalPayload({
    listings: [
      {
        hostLabel: 'Azure North 1204',
        grossRevenueDisplay: '₱348,200',
        occupancyRatePct: 78,
      },
      {
        hostLabel: 'Shore Residences 2B',
        grossRevenueDisplay: '₱264,200',
        occupancyRatePct: 61,
      },
    ],
  });
  assertEquals(
    cmp?.rows.some((row) => row.label.includes('Shore Residences 2B')),
    true
  );
});

Deno.test('timelineFromActivityLog keeps actor names', () => {
  const tl = timelineFromActivityLog({
    entries: [
      {
        at: '2026-10-18T09:12:00+08:00',
        hostLabel: 'Ana Reyes changed the base rate',
        actorName: 'Ana Reyes',
        summary: 'Weekday rate ₱3,000 → ₱3,200',
      },
    ],
  });
  assertEquals(tl?.items[0]?.actor, 'Ana Reyes');
});

Deno.test('hydrateVisualBlocks occupancy trend injects chart', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Occupancy has been climbing.' }],
    [
      {
        trend: [
          { month: '2026-08', occupancyRatePct: 61 },
          { month: '2026-09', occupancyRatePct: 70 },
          { month: '2026-10', occupancyRatePct: 87 },
        ],
      },
    ],
    "What's our occupancy trend?"
  );
  assertEquals(
    out.some((block) => block.type === 'chart'),
    true
  );
});

Deno.test('hydrateVisualBlocks occupancy trend replaces a channel-mix chart', () => {
  const out = hydrateVisualBlocks(
    [
      {
        type: 'chart',
        title: 'Channel mix',
        kind: 'donut',
        series: [{ name: 'Bookings', points: [{ x: 'Direct', y: 3 }] }],
        tableAlt: { columns: ['Channel', 'Bookings'], rows: [{ Channel: 'Direct', Bookings: 3 }] },
        hydrated: true as const,
      },
    ],
    [
      {
        channelMix: [{ channel: 'Direct', count: 3 }],
        trend: [
          { month: '2026-08', occupancyRatePct: 61 },
          { month: '2026-09', occupancyRatePct: 70 },
          { month: '2026-10', occupancyRatePct: 87 },
        ],
      },
    ],
    'Show occupancy trend this year'
  );
  const charts = out.filter((block) => block.type === 'chart');
  assertEquals(charts.length, 1);
  assertEquals(charts[0]?.type === 'chart' ? charts[0].title : '', 'Occupancy trend');
});

Deno.test('hydrateVisualBlocks occupancy rate injects kpi', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Here is the current occupancy overview.' }],
    [{ kpis: { occupancyRatePct: 72, occupancyRateVsPrior: '+4%' } }],
    "What's my occupancy rate?"
  );
  assertEquals(
    out.some((block) => block.type === 'kpi'),
    true
  );
});

Deno.test('hydrateVisualBlocks booked-next-month injects calendar', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Monaco 2612 has one stay scheduled for November 2026.' }],
    [
      {
        propertyName: 'Monaco 2612',
        from: '2026-11-01',
        to: '2026-11-30',
        bookedStays: [],
        availableRanges: [{ start: '2026-11-01', end: '2026-11-30' }],
        availableNightCount: 30,
      },
    ],
    "What's booked next month?"
  );
  assertEquals(
    out.some((block) => block.type === 'calendar'),
    true
  );
});

Deno.test('hydrateVisualBlocks maintenance is overdue injects checklist and drops picker', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Which listing or dates should I use?' }],
    [{ __list: [{ id: 'mt-1', label: 'Leaking faucet', completedAt: null }] }],
    'What maintenance is overdue?'
  );
  assertEquals(
    out.some((block) => block.type === 'checklist'),
    true
  );
  assertEquals(
    out.some(
      (block) =>
        block.type === 'text' &&
        'text' in block &&
        block.text === 'Which listing or dates should I use?'
    ),
    false
  );
});

Deno.test('hydrateVisualBlocks injects attention checklist and drops the dead-end fallback', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Which listing or dates should I use?' }],
    [
      {
        attention: [
          {
            id: 'pending-review',
            label: 'Pending review',
            count: 2,
            href: '/bookings',
            severity: 'warning',
          },
          {
            id: 'inbox-pending',
            label: 'Unread guest messages',
            count: 3,
            href: '/inbox',
            severity: 'info',
          },
        ],
      },
    ],
    'What needs my attention today?'
  );
  const list = out.find((block) => block.type === 'checklist') as
    { type: 'checklist'; items: Array<{ label: string }> } | undefined;
  assertEquals(list?.items.map((item) => item.label) ?? [], [
    '2 Pending review',
    '3 Unread guest messages',
  ]);
  assertEquals(
    out.some(
      (block) =>
        block.type === 'text' &&
        'text' in block &&
        block.text === 'Which listing or dates should I use?'
    ),
    false
  );
});

Deno.test('hydrateVisualBlocks drops a wrapped listing-or-dates picker', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Which listing or dates should I start with?' }],
    [{ attention: [{ id: 'pending-review', label: 'Pending review', count: 1 }] }],
    'What needs my attention today?'
  );
  assertEquals(
    out.some(
      (block) =>
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string' &&
        /which listing or dates/i.test(block.text)
    ),
    false
  );
});

Deno.test('checklistFromPendingTasks drops completed maintenance', () => {
  const list = checklistFromPendingTasks({
    __list: [
      { id: 'mt-1', label: 'Leaking faucet', completedAt: null },
      { id: 'mt-3', label: 'Deep clean', completedAt: '2026-10-01' },
    ],
  });
  assertEquals(
    list?.items.map((item) => item.label),
    ['Leaking faucet']
  );
});

Deno.test('chartFromDemographics uses party size', () => {
  const chart = chartFromDemographics({
    partySize: [
      { label: '1-2 guests', count: 14 },
      { label: '3-4 guests', count: 9 },
    ],
  });
  assertEquals(chart?.title, 'Party size');
  assertEquals(chart?.series[0]?.points[0]?.x, '1-2 guests');
});

Deno.test('checklistFromSetupGuide keeps incomplete steps', () => {
  const list = checklistFromSetupGuide({
    steps: [
      { id: 'profile', label: 'Complete property profile', done: true },
      { id: 'meta', label: 'Connect Facebook or Instagram', done: false },
    ],
  });
  assertEquals(list?.items[1]?.label, 'Connect Facebook or Instagram');
  assertEquals(list?.items[1]?.done, false);
});

Deno.test('checklistFromSuperhost includes cancellation', () => {
  const list = checklistFromSuperhost({
    criteria: [
      { id: 'stays', label: '10 completed stays', met: true, current: '14' },
      {
        id: 'cancellation',
        label: 'Under 1% cancellation rate',
        met: false,
        current: '8%',
      },
    ],
  });
  assertEquals(
    list?.items.some((item) => item.label.toLowerCase().includes('cancellation')),
    true
  );
});

Deno.test('entityCardsFromListResult maps inbox threads', () => {
  const cards = entityCardsFromListResult([
    {
      conversationId: 'conv-1',
      participantName: 'Juan dela Cruz',
      platform: 'web',
      replyStatus: 'pending',
    },
  ]);
  assertEquals(cards[0]?.title, 'Juan dela Cruz');
  assertEquals(cards[0]?.entityType, 'inbox_thread');
});

Deno.test('hydrateVisualBlocks — need-a-reply uses inbox entity cards', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Two threads are waiting.' }],
    [
      {
        threads: [
          {
            conversationId: 'conv-1',
            participantName: 'Juan dela Cruz',
            platform: 'web',
            replyStatus: 'pending',
          },
        ],
      },
    ],
    'Which guest messages need a reply?'
  );
  assertEquals(
    out.some((block) => block.type === 'entity_card'),
    true
  );
});

Deno.test('hydrateVisualBlocks promotes kpi ahead of the model stat_list', () => {
  const out = hydrateVisualBlocks(
    [
      { type: 'text', text: 'October landed well.' },
      {
        type: 'stat_list',
        title: 'October',
        items: [{ label: 'Income', value: '₱48,500' }],
      },
    ],
    [{ display: { netProfit: '₱36,200' }, netProfit: 36200 }],
    'How did October go financially?'
  );
  const types = out.map((block) => block.type);
  assertEquals(types[0], 'text');
  assertEquals(types[1], 'kpi');
  assertEquals(types.includes('stat_list'), true);
});

Deno.test('tableFromTeamMembers omits emails', () => {
  const table = tableFromTeamMembers([
    {
      name: 'Pedro Lim',
      role: 'Property manager',
      status: 'active',
      email: 'pedro@example.test',
    },
  ]);
  assertEquals(table?.rows[0]?.Name, 'Pedro Lim');
  assertEquals(JSON.stringify(table).includes('pedro@example.test'), false);
});

Deno.test('tableFromActivityLog keeps actor names', () => {
  const table = tableFromActivityLog({
    entries: [
      {
        at: '2026-10-17T16:40:00+08:00',
        actorName: 'Pedro Lim',
        summary: 'Blocked 2026-12-27 to 2026-12-28',
      },
    ],
  });
  assertEquals(table?.rows[0]?.Who, 'Pedro Lim');
});

Deno.test('calendarFromPricing uses weekday rates when no overrides exist', () => {
  const cal = calendarFromPricing({
    weekdayNightlyRate: 3200,
    weekendNightlyRate: 3800,
    dateOverrides: {},
    blockedDateKeys: [],
  });
  assertEquals(cal?.type, 'calendar');
  assertEquals((cal?.days.length ?? 0) >= 28, true);
});

Deno.test('hydrateVisualBlocks injects a calendar for rates this month', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Weekday ₱3,200, weekend ₱3,800.' }],
    [
      {
        weekdayNightlyRate: 3200,
        weekendNightlyRate: 3800,
        dateOverrides: {},
        blockedDateKeys: [],
      },
    ],
    'What are my rates this month?'
  );
  assertEquals(
    out.some((block) => block.type === 'calendar'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects a calendar for the next 60 days', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'The next 60 days are mostly open.' }],
    [
      {
        propertyName: 'Monaco 2612',
        from: '2026-10-19',
        to: '2026-12-17',
        bookedStays: [],
        availableRanges: [{ start: '2026-10-19', end: '2026-12-17' }],
        availableNightCount: 60,
      },
    ],
    'Show me the next 60 days'
  );
  assertEquals(
    out.some((block) => block.type === 'calendar'),
    true
  );
});

Deno.test('comparisonFromWeekdayWeekend uses nightly rates', () => {
  const cmp = comparisonFromWeekdayWeekend({
    weekdayNightlyRate: 3200,
    weekendNightlyRate: 3800,
  });
  assertEquals(cmp?.rows[0]?.before, '₱3,200');
  assertEquals(cmp?.rows[0]?.after, '₱3,800');
});

Deno.test('timelineFromActivityLog reads live events who/what', () => {
  const tl = timelineFromActivityLog({
    events: [
      {
        at: '2026-10-18T09:12:00+08:00',
        who: 'Ana Reyes',
        what: 'Weekday rate ₱3,000 → ₱3,200',
      },
    ],
  });
  assertEquals(tl?.items[0]?.actor, 'Ana Reyes');
  assertEquals(tl?.items[0]?.label, 'Weekday rate ₱3,000 → ₱3,200');
});

Deno.test('kpiFromFinanceSummary prefers net profit over occupancy', () => {
  const kpi = kpiFromFinanceSummary({
    kpis: { occupancyRatePct: 68 },
    display: { netProfit: '₱36,200' },
    netProfit: 36200,
  });
  assertEquals(kpi?.label, 'Net profit');
  assertEquals(kpi?.value, '₱36,200');
});

Deno.test('hydrateVisualBlocks injects kpi for how much did I make', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'October income is in.' }],
    [{ display: { netProfit: '₱36,200', totalIncome: '₱48,500' }, netProfit: 36200 }],
    'How much did I make this month?'
  );
  assertEquals(
    out.some((block) => block.type === 'kpi'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects profit facts for how much profit', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'October is in.' }],
    [
      {
        display: {
          netProfit: '₱36,200',
          totalIncome: '₱48,500',
          totalExpenses: '₱12,300',
        },
        netProfit: 36200,
        totalIncome: 48500,
        totalExpenses: 12300,
      },
    ],
    'How much profit did I make this month?'
  );
  assertEquals(
    out.some((block) => block.type === 'kpi'),
    true
  );
  assertEquals(
    out.some((block) => block.type === 'stat_list'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects pending KPI', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Guests still owe.' }],
    [{ display: { pendingPayments: '₱7,000' }, pendingPayments: 7000 }],
    'How much money is still pending from guests?'
  );
  const kpi = out.find((block) => block.type === 'kpi');
  assertEquals(kpi && 'value' in kpi ? kpi.value : '', '₱7,000');
});

Deno.test('hydrateVisualBlocks injects publish history for post last month', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Two posts last month.' }],
    [
      {
        ok: true,
        data: [
          {
            platform: 'facebook',
            publishType: 'story',
            status: 'failed',
            publishedAt: '2026-09-28T10:00:00+08:00',
            caption: 'Weekend stay',
          },
          {
            platform: 'facebook',
            publishType: 'feed',
            status: 'published',
            publishedAt: '2026-09-12T10:00:00+08:00',
            caption: 'October promo',
          },
        ],
      },
    ],
    'What did we post last month?'
  );
  assertEquals(
    out.some((block) => block.type === 'timeline'),
    true
  );
});

Deno.test('chartFromFinanceSummary falls back to income vs expenses', () => {
  const chart = chartFromFinanceSummary({
    display: { totalIncome: '₱48,500', totalExpenses: '₱12,300' },
    totalIncome: 48500,
    totalExpenses: 12300,
    operating: { income: 0, expenses: 12300, net: -12300 },
  });
  assertEquals(chart?.title, 'Income vs expenses');
  assertEquals(chart?.series[0]?.points[0]?.x, 'Income');
});

Deno.test('chartFromFinanceTrend reads analytics revenue trend', () => {
  const chart = chartFromFinanceTrend({
    trend: [
      { month: '2026-05', occupancyRatePct: 61, revenue: 31000 },
      { month: '2026-10', occupancyRatePct: 87, revenue: 48500 },
    ],
  });
  assertEquals(chart?.kind, 'line');
  assertEquals(chart?.series[0]?.points[1]?.y, 48500);
});

Deno.test('hydrateVisualBlocks turns a permission error into a callout', () => {
  const out = hydrateVisualBlocks(
    [
      { type: 'text', text: 'I looked at billing.' },
      { type: 'timeline', title: 'Activity', items: [{ at: '2026-10-18', label: 'Checked' }] },
    ],
    ['You do not have permission to view invoices'],
    'Show me this month invoices'
  );
  assertEquals(
    out.some((block) => block.type === 'callout'),
    true
  );
  assertEquals(
    out.some((block) => block.type === 'timeline'),
    false
  );
});

Deno.test('hydrateVisualBlocks injects a themes carousel', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Two themes are saved.' }],
    [
      {
        items: [
          { id: 'th-1', name: 'Coastal', hostLabel: 'Coastal', source: 'preset' },
          { id: 'th-2', name: 'Night', hostLabel: 'Night', source: 'preset' },
        ],
      },
    ],
    'Show my brand themes'
  );
  assertEquals(
    out.some((block) => block.type === 'carousel'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects publish history from an array payload', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'One post went out.' }],
    [
      [
        {
          platform: 'facebook',
          publishType: 'feed',
          status: 'published',
          publishedAt: '2026-09-12T10:00:00+08:00',
          caption: 'Autumn stay',
        },
      ],
    ],
    'What did we post last month?'
  );
  assertEquals(
    out.some((block) => block.type === 'timeline'),
    true
  );
});

Deno.test('tableFromUnpricedHolidays lists uncovered PH holidays', () => {
  const uncovered = tableFromUnpricedHolidays({ holidayRules: [] }, '2026-10-19');
  assertEquals(uncovered?.title, 'Holidays without a rate rule');
  assertEquals(
    uncovered?.rows.some((row) => row.Holiday === "All Saints' Day"),
    true
  );
  const covered = tableFromUnpricedHolidays(
    { holidayRules: [{ startDate: '2026-11-01', endDate: '2026-11-02' }] },
    '2026-10-19'
  );
  assertEquals(covered, null);
});

Deno.test('hydrateVisualBlocks injects unpriced holidays table', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'A few holidays still need rates.' }],
    [{ holidayRules: [] }],
    'Which holidays have no rate rule?'
  );
  assertEquals(
    out.some((block) => block.type === 'data_table'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects expense donut from byCategory', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Cleaning is the largest cost.' }],
    [{ operating: { byCategory: [{ label: 'Cleaning', amount: 6400 }] } }],
    'Break down expenses by category'
  );
  const chart = out.find((block) => block.type === 'chart');
  assertEquals(chart && 'title' in chart ? chart.title : '', 'Expenses');
});

Deno.test('comparisonFromListings allows a single listing', () => {
  const cmp = comparisonFromListings({
    listings: [{ name: 'Monaco 2612', grossRevenue: 348200, occupancyRatePct: 78 }],
  });
  assertEquals(cmp?.rows[0]?.label, 'Monaco 2612');
});

Deno.test('hydrateVisualBlocks injects listing comparison for earned the most', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Monaco leads this year.' }],
    [{ listings: [{ name: 'Monaco 2612', grossRevenue: 348200, occupancyRatePct: 78 }] }],
    'Which property earned the most this year?'
  );
  assertEquals(
    out.some((block) => block.type === 'comparison'),
    true
  );
});

Deno.test('comparisonFromBenchmark uses median occupancy and ADR', () => {
  const cmp = comparisonFromBenchmark({
    kpis: { occupancyRatePct: 68, adrDisplay: '₱3,200' },
    benchmark: {
      available: true,
      medianOccupancyRatePct: 54,
      medianAdrDisplay: '₱2,800',
    },
  });
  assertEquals(cmp?.title, 'This listing vs Kame median');
  assertEquals(cmp?.rows[0]?.after, '54%');
});

Deno.test('hydrateVisualBlocks injects playbook checklist', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Next month looks soft.' }],
    [{ suggestedPlaybookArticles: [{ title: 'Fill weekday gaps', category: 'occupancy' }] }],
    'Why is next month low and what can I do?'
  );
  assertEquals(
    out.some((block) => block.type === 'checklist'),
    true
  );
  assertEquals(checklistFromPlaybook({ suggestedPlaybookArticles: [] }), null);
});

Deno.test('kpiFromPlanSnapshot shows remaining messages', () => {
  const kpi = kpiFromPlanSnapshot({
    assistantQuota: {
      messagesUsedToday: 12,
      dailyMessageLimit: 50,
      messagesRemainingToday: 38,
    },
  });
  assertEquals(kpi?.label, 'AI messages left today');
  assertEquals(kpi?.value, '38');
});

Deno.test('hydrateVisualBlocks injects quota kpi', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'You still have room today.' }],
    [{ assistantQuota: { messagesRemainingToday: 38, dailyMessageLimit: 50 } }],
    'How many AI messages do I have left?'
  );
  assertEquals(
    out.some((block) => block.type === 'kpi'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects a RevPAR glossary callout', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'RevPAR combines occupancy and rate.' }],
    [
      {
        metric: 'revpar',
        explanation:
          'RevPAR (Revenue per Available Night) = gross lodging revenue ÷ total nights available.',
      },
    ],
    'Explain RevPAR'
  );
  assertEquals(
    out.some((block) => block.type === 'callout'),
    true
  );
  assertEquals(
    calloutFromMetricExplanation({
      metric: 'revpar',
      explanation: 'RevPAR combines occupancy and rate.',
    })?.text.includes('RevPAR'),
    true
  );
});

Deno.test('hydrateVisualBlocks callout when there are no brand themes', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Nothing saved yet.' }],
    [{ items: [] }],
    'Show my brand themes'
  );
  assertEquals(
    out.some((block) => block.type === 'callout'),
    true
  );
});

Deno.test('calloutFromEmptyActivity when the log is empty', () => {
  assertEquals(calloutFromEmptyActivity({ events: [] })?.text, 'No changes in that window.');
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Nothing yesterday.' }],
    [{ events: [] }],
    'Who changed the price yesterday?'
  );
  assertEquals(
    out.some((block) => block.type === 'callout'),
    true
  );
});

Deno.test('timelineFromMaintenance uses completed items', () => {
  const tl = timelineFromMaintenance({
    __list: [
      { label: 'Leaking faucet', completedAt: '2026-09-12T10:00:00+08:00', category: 'plumbing' },
      { label: 'Open AC', completedAt: null },
    ],
  });
  assertEquals(tl?.items.length, 1);
  assertEquals(tl?.items[0]?.label, 'Leaking faucet');
});

Deno.test('hydrateVisualBlocks injects a thread card', () => {
  const listed = hydrateVisualBlocks(
    [{ type: 'text', text: 'Juan is waiting.' }],
    [
      {
        ok: true,
        data: [
          {
            conversationId: 'c-1',
            participantName: 'Juan dela Cruz',
            platform: 'web',
            replyStatus: 'pending',
          },
        ],
      },
    ],
    'Open the thread with Juan'
  );
  assertEquals(
    listed.some((block) => block.type === 'entity_card'),
    true
  );
  const opened = hydrateVisualBlocks(
    [{ type: 'text', text: 'Juan is waiting.' }],
    [
      {
        ok: true,
        data: {
          conversationId: 'c-1',
          participantName: 'Juan dela Cruz',
          platform: 'web',
          replyStatus: 'pending',
          messages: [{ direction: 'inbound', text: 'Hi' }],
        },
      },
    ],
    'Open the thread with Juan'
  );
  assertEquals(
    opened.some((block) => block.type === 'entity_card'),
    true
  );
});

Deno.test('timelineFromBookingHistory maps statusHistory', () => {
  const timeline = timelineFromBookingHistory({
    bookingId: 'b1',
    statusHistory: [
      { at: '2026-10-01T08:00:00+08:00', label: 'Submitted', actor: 'Maria Santos' },
      { at: '2026-10-02T09:00:00+08:00', label: 'Ready for check-in', actor: 'Ana Reyes' },
    ],
  });
  assertEquals(timeline?.title, 'Booking history');
  assertEquals(timeline?.items[1]?.label, 'Ready for check-in');
});

Deno.test('hydrateVisualBlocks injects a booking-history timeline', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'No recent org activity.' }],
    [
      {
        bookingId: 'b1',
        hostLabel: 'Maria Santos · Dec 20-22',
        statusHistory: [
          { at: '2026-10-01T08:00:00+08:00', label: 'Submitted' },
          { at: '2026-10-02T09:00:00+08:00', label: 'Ready for check-in' },
        ],
      },
    ],
    'What happened to this booking? (history)'
  );
  assertEquals(
    out.some((block) => block.type === 'timeline'),
    true
  );
});

Deno.test('hydrateVisualBlocks injects completed-maintenance timeline', () => {
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Two jobs last month.' }],
    [
      {
        ok: true,
        data: [
          {
            label: 'Leaking faucet',
            completedAt: '2026-09-12T10:00:00+08:00',
            category: 'plumbing',
          },
        ],
      },
    ],
    'What did we fix last month?'
  );
  assertEquals(
    out.some((block) => block.type === 'timeline'),
    true
  );
});

Deno.test('comparisonFromFinancePeriods needs two summaries', () => {
  const cmp = comparisonFromFinancePeriods([
    { period: { from: '2026-07-01' }, netProfit: 42000, display: { netProfit: '₱42,000' } },
    { period: { from: '2026-04-01' }, netProfit: 31000, display: { netProfit: '₱31,000' } },
  ]);
  assertEquals(cmp?.columns[0], '2026-07');
  assertEquals(cmp?.rows[0]?.before.includes('₱42,000'), true);
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Last quarter was stronger.' }],
    [
      { period: { from: '2026-07-01' }, netProfit: 42000 },
      { period: { from: '2026-04-01' }, netProfit: 31000 },
    ],
    "What's my net profit last quarter vs the one before?"
  );
  assertEquals(
    out.some((block) => block.type === 'comparison'),
    true
  );
});

Deno.test('hydrateVisualBlocks demotes a next-60-days table for a calendar', () => {
  const out = hydrateVisualBlocks(
    [
      { type: 'text', text: 'Next 60 days.' },
      {
        type: 'data_table',
        title: 'Availability',
        columns: ['Date'],
        rows: [{ Date: '2026-12-01' }],
      },
    ],
    [
      {
        propertyName: 'Azure North 1204',
        from: '2026-10-19',
        to: '2026-12-17',
        bookedStays: [],
        availableRanges: [{ start: '2026-10-19', end: '2026-12-17' }],
        availableNightCount: 60,
      },
    ],
    'Show me the next 60 days'
  );
  assertEquals(
    out.some((block) => block.type === 'calendar'),
    true
  );
  assertEquals(
    out.some((block) => block.type === 'data_table'),
    false
  );
});

Deno.test('hydrateVisualBlocks injects last-6-months income vs expenses chart', () => {
  const out = hydrateVisualBlocks(
    [
      { type: 'text', text: 'Income held up.' },
      {
        type: 'data_table',
        title: 'Totals',
        columns: ['Month', 'Income'],
        rows: [{ Month: 'May', Income: '₱31,000' }],
      },
    ],
    [
      {
        months: [
          { month: '2026-05', label: 'May', income: 31000, expenses: 9800 },
          { month: '2026-06', label: 'Jun', income: 28000, expenses: 9100 },
          { month: '2026-07', label: 'Jul', income: 42000, expenses: 11000 },
          { month: '2026-08', label: 'Aug', income: 39000, expenses: 10800 },
          { month: '2026-09', label: 'Sep', income: 45000, expenses: 12000 },
          { month: '2026-10', label: 'Oct', income: 48500, expenses: 12300 },
        ],
      },
    ],
    'Revenue vs expenses for the last 6 months'
  );
  const chart = out.find((block) => block.type === 'chart');
  assertEquals(chart && 'title' in chart ? chart.title : '', 'Income vs expenses');
  assertEquals(chart && 'kind' in chart ? chart.kind : '', 'line');
  assertEquals(
    out.some((block) => block.type === 'data_table'),
    false
  );
});

Deno.test('comparisonFromFinanceTrendQuarters groups six months', () => {
  const cmp = comparisonFromFinanceTrendQuarters({
    months: [
      { month: '2026-04', label: 'Apr', income: 10000, expenses: 4000 },
      { month: '2026-05', label: 'May', income: 11000, expenses: 4000 },
      { month: '2026-06', label: 'Jun', income: 12000, expenses: 4000 },
      { month: '2026-07', label: 'Jul', income: 20000, expenses: 5000 },
      { month: '2026-08', label: 'Aug', income: 21000, expenses: 5000 },
      { month: '2026-09', label: 'Sep', income: 22000, expenses: 5000 },
    ],
  });
  assertEquals(cmp?.columns[0], '2026-Q3');
  assertEquals(cmp?.columns[1], '2026-Q2');
  const out = hydrateVisualBlocks(
    [{ type: 'text', text: 'Last quarter was stronger.' }],
    [
      {
        months: [
          { label: '2026-04', income: 10000, expenses: 4000 },
          { label: '2026-05', income: 11000, expenses: 4000 },
          { label: '2026-06', income: 12000, expenses: 4000 },
          { label: '2026-07', income: 20000, expenses: 5000 },
          { label: '2026-08', income: 21000, expenses: 5000 },
          { label: '2026-09', income: 22000, expenses: 5000 },
        ],
      },
    ],
    "What's my net profit last quarter vs the one before?"
  );
  assertEquals(
    out.some((block) => block.type === 'comparison'),
    true
  );
});
