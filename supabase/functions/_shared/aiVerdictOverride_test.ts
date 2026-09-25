import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import type { ActorContext } from './activityLog.ts';
import { assertAiVerdictAllowsProceed } from './aiVerdictOverride.ts';
import { EdgeError } from './httpResponse.ts';

const host = { actorType: 'team_member', source: 'dashboard' } as ActorContext;
const assistant = { actorType: 'ai_assistant', source: 'dashboard' } as ActorContext;
const cron = { actorType: 'cron', source: 'cron' } as ActorContext;
const message = 'Receipt failed AI validation.';

Deno.test('assertAiVerdictAllowsProceed — non-invalid verdicts never block', () => {
  for (const verdict of ['valid', 'likely_valid', 'unclear', null, undefined]) {
    assertEquals(assertAiVerdictAllowsProceed({ verdict, payload: {}, actor: host, message }), false);
  }
});

Deno.test('assertAiVerdictAllowsProceed — invalid verdict blocks with a coded 409', () => {
  const err = assertThrows(
    () => assertAiVerdictAllowsProceed({ verdict: 'invalid', payload: {}, actor: host, message }),
    EdgeError
  );
  assertEquals(err.status, 409);
  assertEquals(err.code, 'ai_verdict_blocked');
});

Deno.test('assertAiVerdictAllowsProceed — a host can explicitly proceed (override applied)', () => {
  assertEquals(
    assertAiVerdictAllowsProceed({
      verdict: 'invalid',
      payload: { override_ai_verdict: true },
      actor: host,
      message,
    }),
    true
  );
});

Deno.test('assertAiVerdictAllowsProceed — the AI assistant and automation can never override', () => {
  for (const actor of [assistant, cron, undefined]) {
    assertThrows(
      () =>
        assertAiVerdictAllowsProceed({
          verdict: 'invalid',
          payload: { override_ai_verdict: true },
          actor,
          message,
        }),
      EdgeError
    );
  }
});
