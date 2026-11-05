import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  aiHandoffColumns,
  isAutoReplyPausedByHandoff,
  MAX_HANDOFF_REASON_CHARS,
} from './aiHandoff.ts';

const now = new Date('2026-11-01T10:00:00.000Z');

Deno.test('a handoff stores a tidy reason and the time', () => {
  assertEquals(
    aiHandoffColumns({ ai_handoff: { reason: '  Wants   to cancel \n their stay ' } }, now),
    {
      ai_handoff_at: '2026-11-01T10:00:00.000Z',
      ai_handoff_reason: 'Wants to cancel their stay',
    }
  );
});

Deno.test('an empty reason is stored as null, a long one is clipped', () => {
  assertEquals(aiHandoffColumns({ ai_handoff: { reason: '   ' } }, now).ai_handoff_reason, null);
  const long = aiHandoffColumns({ ai_handoff: { reason: 'x'.repeat(1000) } }, now);
  assertEquals(String(long.ai_handoff_reason).length, MAX_HANDOFF_REASON_CHARS);
});

Deno.test('a human reply clears the handoff, and a new handoff wins over a clear', () => {
  assertEquals(aiHandoffColumns({ clear_ai_handoff: true }), {
    ai_handoff_at: null,
    ai_handoff_reason: null,
  });
  const both = aiHandoffColumns({ ai_handoff: { reason: 'help' }, clear_ai_handoff: true }, now);
  assertEquals(both.ai_handoff_at, '2026-11-01T10:00:00.000Z');
});

Deno.test('patches that do not mention handoff change nothing', () => {
  assertEquals(aiHandoffColumns({}), {});
  assertEquals(aiHandoffColumns({ ai_handoff: null, clear_ai_handoff: false }), {});
});

Deno.test('auto-replies pause only while a handoff is open', () => {
  assertEquals(isAutoReplyPausedByHandoff({ ai_handoff_at: '2026-11-01T10:00:00.000Z' }), true);
  assertEquals(isAutoReplyPausedByHandoff({ ai_handoff_at: null }), false);
  assertEquals(isAutoReplyPausedByHandoff({}), false);
});
