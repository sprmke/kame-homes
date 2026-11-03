import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  countTurnIntents,
  isComplexDashboardTurn,
  resolveDashboardAssistantFeature,
} from './modelPolicy.ts';

function signal(partial: Partial<Parameters<typeof isComplexDashboardTurn>[0]> = {}) {
  return {
    message: '',
    attachmentCount: 0,
    matchedModuleCount: 0,
    routerFailedOpen: false,
    ...partial,
  };
}

Deno.test('countTurnIntents — a single plain question is one intent', () => {
  assertEquals(countTurnIntents('How many open maintenance items do I have?'), 1);
});

Deno.test('countTurnIntents — two asks joined by "and" count as two', () => {
  assertEquals(
    countTurnIntents('Block Dec 24 to 26 and message the Garcia booking about check-in.') >= 2,
    true
  );
});

Deno.test('isComplexDashboardTurn — a plain read-only question is simple', () => {
  assertEquals(isComplexDashboardTurn(signal({ message: 'How many bookings do I have?' })), false);
});

Deno.test('isComplexDashboardTurn — any attachment is complex', () => {
  assertEquals(isComplexDashboardTurn(signal({ attachmentCount: 1 })), true);
});

Deno.test('isComplexDashboardTurn — the router failing open is complex', () => {
  assertEquals(isComplexDashboardTurn(signal({ routerFailedOpen: true })), true);
});

Deno.test(
  'isComplexDashboardTurn — matching 3+ modules is complex even with simple phrasing',
  () => {
    assertEquals(isComplexDashboardTurn(signal({ matchedModuleCount: 3 })), true);
    assertEquals(isComplexDashboardTurn(signal({ matchedModuleCount: 2 })), false);
  }
);

Deno.test('isComplexDashboardTurn — a write verb alone is complex', () => {
  assertEquals(isComplexDashboardTurn(signal({ message: 'Cancel the Reyes booking.' })), true);
});

Deno.test('isComplexDashboardTurn — two asks in one message is complex', () => {
  assertEquals(
    isComplexDashboardTurn(
      signal({ message: 'What is my occupancy this week, and who checks out tomorrow?' })
    ),
    true
  );
});

Deno.test('resolveDashboardAssistantFeature — maps complexity to the right feature key', () => {
  assertEquals(resolveDashboardAssistantFeature(signal()), 'dashboard_assistant');
  assertEquals(
    resolveDashboardAssistantFeature(signal({ attachmentCount: 1 })),
    'dashboard_assistant_complex'
  );
});
