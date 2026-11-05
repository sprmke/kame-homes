import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildHeldBackBlocks, HELD_BACK_CONTINUE_ACTION } from './heldBackSteps.ts';

Deno.test('nothing held back returns no blocks', () => {
  assertEquals(buildHeldBackBlocks({ proposalSummaries: [], queuedWriteLabels: [] }), []);
  assertEquals(buildHeldBackBlocks({ proposalSummaries: ['  '], queuedWriteLabels: [''] }), []);
});

Deno.test('lists proposals first, then queued writes, with a continue chip', () => {
  const blocks = buildHeldBackBlocks({
    proposalSummaries: ['Block Dec 24 to 26'],
    queuedWriteLabels: ['Updating weekend rates…'],
  });
  assertEquals(blocks.length, 2);
  const text = (blocks[0] as { text: string }).text;
  assertEquals(text.includes('- Block Dec 24 to 26\n- Updating weekend rates'), true);
  assertEquals(text.includes('held back 2 other steps'), true);
  assertEquals(blocks[1], { type: 'quick_actions', actions: [{ ...HELD_BACK_CONTINUE_ACTION }] });
});

Deno.test('singular wording for one step and no em dash anywhere', () => {
  const [block] = buildHeldBackBlocks({
    proposalSummaries: ['Cancel booking'],
    queuedWriteLabels: [],
  });
  const text = (block as { text: string }).text;
  assertEquals(text.includes('held back 1 other step,'), true);
  assertEquals(text.includes('—'), false);
});

Deno.test('caps the list and reports how many more', () => {
  const summaries = Array.from({ length: 9 }, (_, i) => `Step ${i + 1}`);
  const [block] = buildHeldBackBlocks({ proposalSummaries: summaries, queuedWriteLabels: [] });
  const text = (block as { text: string }).text;
  assertEquals(text.includes('- Step 6'), true);
  assertEquals(text.includes('- Step 7'), false);
  assertEquals(text.includes('- and 3 more'), true);
});
