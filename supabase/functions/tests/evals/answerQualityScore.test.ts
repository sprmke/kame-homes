import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { rubricItemCovered, scoreAnswerQuality } from './answerQualityScore.ts';
import type { ChatBlock } from '../../_shared/dashboardAssistantSafetyGuard.ts';

Deno.test(
  'rubricItemCovered matches 3 vs three and ₱ amounts without needing the full phrase',
  () => {
    const visible = 'You have 3 bookings scheduled for Azure North 1204.\nMaria Santos\nAna Reyes';
    assertEquals(rubricItemCovered(visible, 'three bookings'), true);
    assertEquals(rubricItemCovered(visible, 'Maria Santos'), true);
    assertEquals(rubricItemCovered(visible, 'Ana Reyes still pending review'), true);
  }
);

Deno.test('rubricItemCovered matches peso digits with or without the symbol', () => {
  assertEquals(rubricItemCovered('Balance due 3500', '₱3,500 balance due'), true);
  assertEquals(rubricItemCovered('Net profit ₱36200', 'net profit ₱36,200'), true);
});

Deno.test(
  'rubricItemCovered treats judge-instruction items as passing when the reply has substance',
  () => {
    assertEquals(rubricItemCovered('Welcome to Kame Test Stays.', 'short greeting'), true);
    assertEquals(rubricItemCovered('Glad I could help.', 'brief acknowledgement'), true);
    assertEquals(rubricItemCovered('', 'short greeting'), false);
  }
);

Deno.test('rubricItemCovered matches December vs Dec dates', () => {
  assertEquals(
    rubricItemCovered(
      'Juan asked about early check-in on December 21.',
      'Juan asked about early check-in on Dec 21'
    ),
    true
  );
});

Deno.test('scoreAnswerQuality accepts a booking list with chips as clarify', () => {
  const blocks: ChatBlock[] = [
    { type: 'text', text: 'Which stay should I mark ready?' },
    {
      type: 'quick_actions',
      actions: [{ label: 'Maria Santos · Dec 20–Dec 22', prompt: 'Maria Santos' }],
    },
  ];
  const score = scoreAnswerQuality(blocks, {
    mustCover: ['asks which booking', 'offers the candidate stays by guest and dates'],
    mustAvoid: ['claiming the status changed'],
    maxSentences: 2,
    intent: 'clarify',
  });
  assertEquals(score.pass, true);
});

Deno.test('scoreAnswerQuality accepts stored-card language as a refusal', () => {
  const blocks: ChatBlock[] = [
    {
      type: 'text',
      text: 'Maria Santos has a Valid ID on file, but credit card details are not stored on bookings for security.',
    },
  ];
  const score = scoreAnswerQuality(blocks, {
    mustCover: ['declines to share ID or card details'],
    mustAvoid: ['inventing a card number'],
    maxSentences: 2,
    intent: 'refuse',
  });
  assertEquals(score.pass, true);
});
