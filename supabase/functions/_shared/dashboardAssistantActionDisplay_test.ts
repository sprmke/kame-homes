import {
  buildActionConfirmationDetails,
  buildPricingBaseRateSummary,
  humanizeActionConfirmationSummary,
  humanizeHostFacingCopy,
  humanizeHostFieldLabel,
} from './dashboardAssistantActionDisplay.ts';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

Deno.test('buildPricingBaseRateSummary never uses camelCase keys', () => {
  const summary = buildPricingBaseRateSummary('property', { weekendNightlyRate: 3299 });
  assertEqual(summary.includes('weekendNightlyRate'), false, 'no camelCase');
  assertEqual(summary.includes('weekend nightly rate'), true, 'human label');
  assertEqual(summary.includes('₱3,299'), true, 'peso amount');
});

Deno.test('humanizeHostFacingCopy rewrites camelCase in free text', () => {
  const text = humanizeHostFacingCopy('Update property base rates: weekendNightlyRate.');
  assertEqual(text.includes('weekendNightlyRate'), false, 'no camelCase');
  assertEqual(text.includes('weekend nightly rate'), true, 'rewritten');
});

Deno.test('humanizeActionConfirmationSummary prefers payload when summary empty', () => {
  const summary = humanizeActionConfirmationSummary('propose_update_property_base_rate', '', {
    weekendNightlyRate: 3299,
  });
  assertEqual(summary.includes('weekendNightlyRate'), false, 'no camelCase');
  assertEqual(humanizeHostFieldLabel('weekendNightlyRate'), 'Weekend nightly rate', 'label map');
});

Deno.test('humanizeActionConfirmationSummary formats date override with peso', () => {
  const summary = humanizeActionConfirmationSummary(
    'propose_set_property_date_rate_override',
    'Set the rate for 2026-12-31 to 6500.',
    { date: '2026-12-31', rate: 6500 }
  );
  assertEqual(summary.includes('₱6,500'), true, 'peso amount');
  assertEqual(summary.includes('Dec 31, 2026'), true, 'host date');
  assertEqual(summary.includes(' to 6500'), false, 'no bare amount');
});

Deno.test('humanizeActionConfirmationSummary formats block dates', () => {
  const summary = humanizeActionConfirmationSummary(
    'propose_block_property_dates',
    'Block 2027-01-01 to 2027-01-03 from availability.',
    { startDate: '2027-01-01', endDate: '2027-01-03' }
  );
  assertEqual(summary.includes('Jan 1, 2027'), true, 'start date');
  assertEqual(summary.includes('Jan 3, 2027'), true, 'end date');
  assertEqual(summary.includes('2027-01-01'), false, 'no iso start');
});

Deno.test('humanizeActionConfirmationSummary formats finance add with peso and date', () => {
  const summary = humanizeActionConfirmationSummary(
    'propose_add_finance_line_item',
    'Add expense "Cleaning expense" (Cleaning) for 1200 on 2026-10-19.',
    {
      kind: 'expense',
      label: 'Cleaning expense',
      category: 'Cleaning',
      amount: 1200,
      occurredOn: '2026-10-19',
    }
  );
  assertEqual(summary.includes('₱1,200'), true, 'peso amount');
  assertEqual(summary.includes('Oct 19, 2026'), true, 'host date');
  assertEqual(summary.includes(' for 1200 '), false, 'no bare amount');
});

Deno.test('buildActionConfirmationDetails formats dates and snake_case values', () => {
  const details = buildActionConfirmationDetails('propose_create_support_ticket', {
    category: 'bug_report',
    occurredOn: '2026-10-19',
  });
  const category = details.find((row) => row.label === 'Category');
  const occurred = details.find((row) => row.label === 'Occurred On');
  assertEqual(category?.value, 'Bug Report', 'category');
  assertEqual(occurred?.value, 'Oct 19, 2026', 'date');
});

Deno.test('humanizeActionConfirmationSummary replaces maintenance UUID with hostLabel', () => {
  const summary = humanizeActionConfirmationSummary(
    'propose_delete_maintenance_item',
    'Delete maintenance item ala10002-0000-4000-8000-000000000002. This cannot be undone.',
    { hostLabel: 'Leaking faucet · Open', id: 'ala10002-0000-4000-8000-000000000002' }
  );
  assertEqual(summary.includes('ala10002-0000-4000-8000-000000000002'), false, 'no uuid');
  assertEqual(summary.includes('Leaking faucet · Open'), true, 'host label');
});
