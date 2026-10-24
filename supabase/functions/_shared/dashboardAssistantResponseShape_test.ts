import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { canSkipStructuredSynth, shapeCandidateBlocks } from './dashboardAssistantResponseShape.ts';

Deno.test('canSkipStructuredSynth is true when hydrators have input', () => {
  assertEquals(
    canSkipStructuredSynth({ hasInlineBlocks: true, hasToolResults: false, hasDraftText: false }),
    true
  );
  assertEquals(
    canSkipStructuredSynth({ hasInlineBlocks: false, hasToolResults: true, hasDraftText: false }),
    true
  );
  assertEquals(
    canSkipStructuredSynth({ hasInlineBlocks: false, hasToolResults: false, hasDraftText: true }),
    true
  );
});

Deno.test('canSkipStructuredSynth is false only with nothing to hydrate', () => {
  assertEquals(
    canSkipStructuredSynth({ hasInlineBlocks: false, hasToolResults: false, hasDraftText: false }),
    false
  );
});

Deno.test('shapeCandidateBlocks — skip-synth with tools does not show a generate failure', () => {
  const shaped = shapeCandidateBlocks({
    modelBlocks: [],
    draftText: '',
    toolResults: [
      {
        total: 1,
        bookings: [
          {
            bookingId: 'b-1',
            guestName: 'Maria Santos',
            checkIn: '2026-10-19',
            checkOut: '2026-10-21',
            status: 'READY_FOR_CHECKIN',
            statusLabel: 'Ready for Check-in',
          },
        ],
      },
    ],
    groundingText: 'Maria Santos Ready for Check-in 2026-10-19 2026-10-21',
    userMessage: "Show me Maria Santos's booking",
  });
  const texts = shaped.blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ');
  assertEquals(/couldn't generate/i.test(texts), false);
  assertEquals(
    shaped.blocks.some((block) => block.type === 'booking_card' || block.type === 'data_table'),
    true
  );
});
