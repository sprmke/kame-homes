import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { describeOpenPlanSteps } from './completionCheck.ts';

Deno.test('describeOpenPlanSteps — null when nothing is open', () => {
  assertEquals(describeOpenPlanSteps([]), null);
});

Deno.test('describeOpenPlanSteps — names a single open step', () => {
  assertEquals(
    describeOpenPlanSteps([{ id: 'plan-1', label: 'Message the Garcia booking.' }]),
    "I didn't get to: Message the Garcia booking."
  );
});

Deno.test('describeOpenPlanSteps — lists every open step, trailing punctuation stripped', () => {
  assertEquals(
    describeOpenPlanSteps([
      { id: 'plan-0', label: 'Block Dec 24 to 26!' },
      { id: 'plan-1', label: 'Raise weekend rates' },
    ]),
    "I didn't get to: Block Dec 24 to 26, Raise weekend rates."
  );
});
