import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  enforceResponseShape,
  stripFillerOpener,
  trimHeadline,
} from './dashboardAssistantResponsePolicy.ts';
import type { ChatBlock } from './dashboardAssistantSafetyGuard.ts';

Deno.test('stripFillerOpener drops Sure / Of course openers', () => {
  assertEquals(stripFillerOpener('Sure! Check-in is 2 PM.'), 'Check-in is 2 PM.');
  assertEquals(stripFillerOpener('Of course, two stays are waiting.'), 'two stays are waiting.');
});

Deno.test('trimHeadline keeps the first useful sentence under 240 chars', () => {
  const long =
    'Great question! Let me walk you through your October finances in detail. First, your total income for the month came in at ₱48,500, which reflects all stays with a check-in in October.';
  const out = trimHeadline(long);
  assertEquals(out.includes('Great question'), false);
  assertEquals(out.length <= 240, true);
});

Deno.test('enforceResponseShape caps chips at four', () => {
  const blocks: ChatBlock[] = [
    { type: 'text', text: 'Pick a stay.' },
    {
      type: 'quick_actions',
      actions: [
        { label: 'One', prompt: 'one' },
        { label: 'Two', prompt: 'two' },
        { label: 'Three', prompt: 'three' },
        { label: 'Four', prompt: 'four' },
        { label: 'Five', prompt: 'five' },
      ],
    },
  ];
  const out = enforceResponseShape(blocks);
  const chips = out.find((b) => b.type === 'quick_actions');
  assertEquals(chips && chips.type === 'quick_actions' ? chips.actions.length : 0, 4);
});

Deno.test('enforceResponseShape prepends text when the answer is chips only', () => {
  const out = enforceResponseShape([
    {
      type: 'quick_actions',
      actions: [{ label: 'Maria Santos', prompt: 'Show Maria' }],
    },
  ]);
  assertEquals(out[0]?.type, 'text');
  assertEquals(
    out.some((b) => b.type === 'quick_actions'),
    true
  );
});

Deno.test('enforceResponseShape drops a second numeric block and extra prose', () => {
  const out = enforceResponseShape([
    {
      type: 'text',
      text: 'Great question! Let me walk you through your October finances in detail. First, income is ₱48,500.',
    },
    {
      type: 'text',
      text: 'To summarize once more: income ₱48,500, expenses ₱12,300, net profit ₱36,200.',
    },
    {
      type: 'stat_list',
      title: 'October',
      items: [{ label: 'Income', value: '₱48,500' }],
    },
    {
      type: 'data_table',
      title: 'B',
      columns: ['x'],
      rows: [{ x: '1' }],
    },
  ]);
  assertEquals(
    out.map((b) => b.type),
    ['text', 'stat_list']
  );
  const text = out[0];
  assertEquals(text?.type === 'text' && text.text.includes('Great question'), false);
  assertEquals(text?.type === 'text' && text.text.length <= 240, true);
});
