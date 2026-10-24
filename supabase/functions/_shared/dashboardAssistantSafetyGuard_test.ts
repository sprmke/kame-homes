import { assertBlocksGrounded, type ChatBlock } from './dashboardAssistantSafetyGuard.ts';

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

Deno.test('assertBlocksGrounded accepts grounded map coordinates from href', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'map',
      href: 'https://maps.google.com/?q=14.5995,120.9842',
      lat: 14.5995,
      lng: 120.9842,
      label: 'Makati',
    },
  ];
  const grounded = assertBlocksGrounded(
    blocks,
    'Map link: https://maps.google.com/?q=14.5995,120.9842'
  );
  assertEqual(grounded.ok, true, 'grounded map should pass');
  assertEqual(grounded.rejectedIndexes.length, 0, 'no rejected blocks');
});

Deno.test('assertBlocksGrounded rejects map coordinates that do not match grounded data', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'map',
      href: 'https://maps.google.com/?q=14.5995,120.9842',
      lat: 10.3157,
      lng: 123.8854,
      label: 'Wrong pin',
    },
  ];
  const grounded = assertBlocksGrounded(
    blocks,
    'Map link: https://maps.google.com/?q=14.5995,120.9842'
  );
  assertEqual(grounded.ok, false, 'mismatched coords should fail');
  assertEqual(grounded.rejectedIndexes.includes(0), true, 'map block rejected');
});

const FINANCE_GROUNDING = JSON.stringify({
  totalIncome: 48500,
  netProfit: 36200,
  display: { netProfit: '₱36,200' },
  period: { from: '2026-10-01', to: '2026-10-31' },
  occupancyRatePct: 68,
});

Deno.test('assertBlocksGrounded accepts formatted amounts that trace back to tool numbers', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'stat_list',
      title: 'October',
      items: [
        { label: 'Income', value: '₱48,500' },
        { label: 'Net profit', value: '₱36,200' },
        { label: 'Occupancy', value: '68%' },
      ],
    },
    {
      type: 'data_table',
      title: 'Period',
      columns: ['From', 'To', 'Share'],
      rows: [{ From: '2026-10-01', To: 'Oct 31', Share: '100%' }],
    },
  ];
  const grounded = assertBlocksGrounded(blocks, FINANCE_GROUNDING);
  assertEqual(grounded.ok, true, `grounded amounts should pass (${grounded.reason})`);
});

Deno.test('assertBlocksGrounded rejects a formatted amount absent from the tool results', () => {
  const blocks: ChatBlock[] = [
    { type: 'text', text: 'Summary' },
    { type: 'stat_list', title: 'October', items: [{ label: 'Net profit', value: '₱99,999' }] },
    {
      type: 'data_table',
      title: 'Rows',
      columns: ['Item', 'Amount'],
      rows: [{ Item: 'Cleaning', Amount: '1,250.50' }],
    },
  ];
  const grounded = assertBlocksGrounded(blocks, FINANCE_GROUNDING);
  assertEqual(grounded.ok, false, 'ungrounded amounts should fail');
  assertEqual(JSON.stringify(grounded.rejectedIndexes), '[1,2]', 'both amount blocks rejected');
  assertEqual(grounded.rejectedIndexes.includes(0), false, 'text block untouched');
});

Deno.test('assertBlocksGrounded ignores short numbers such as days and counts', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'data_table',
      title: 'Bookings',
      columns: ['Guest', 'Stay', 'Nights'],
      rows: [{ Guest: 'Maria', Stay: 'Dec 20–Dec 22', Nights: '2' }],
    },
  ];
  const grounded = assertBlocksGrounded(blocks, '{"guestName":"Maria"}');
  assertEqual(grounded.ok, true, 'short numbers are not gated');
});

Deno.test('assertBlocksGrounded rejects map when href is ungrounded', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'map',
      href: 'https://maps.google.com/?q=14.5995,120.9842',
      lat: null,
      lng: null,
      label: 'Makati',
    },
  ];
  const grounded = assertBlocksGrounded(blocks, 'No map links in this context.');
  assertEqual(grounded.ok, false, 'ungrounded href should fail');
  assertEqual(grounded.rejectedIndexes.includes(0), true, 'map block rejected');
});
