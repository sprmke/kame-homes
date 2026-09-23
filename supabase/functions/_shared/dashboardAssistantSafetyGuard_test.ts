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
