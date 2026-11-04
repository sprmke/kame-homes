import './testSupabaseEnv.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  aggregateGuardFacts,
  GUEST_HANDOFF_FALLBACK_REPLY,
  safeModelPartsForRound,
  toolsFor,
  type GuestReceptionistTurnInput,
} from './guestReceptionistTurn.ts';
import type { GuestReceptionistToolResult } from './guestReceptionistTools.ts';

function result(partial: Partial<GuestReceptionistToolResult>): GuestReceptionistToolResult {
  return { spokenText: '', actions: [], richCard: null, ...partial };
}

function baseInput(
  actorType?: GuestReceptionistTurnInput['actorType']
): GuestReceptionistTurnInput {
  return {
    orgId: 'org-1',
    platform: 'web',
    conversationType: 'dm',
    participantName: null,
    messages: [],
    actorType,
  };
}

Deno.test('aggregateGuardFacts - pulls numbers from plain spokenText', () => {
  const { pricingValues } = aggregateGuardFacts([
    result({ spokenText: 'The total is 5600 pesos.' }),
  ]);
  assert(pricingValues.includes(5600));
});

Deno.test('aggregateGuardFacts - pulls numbers and text from a table card', () => {
  const { pricingValues, factsText } = aggregateGuardFacts([
    result({
      spokenText: 'Here is the quote.',
      richCard: {
        kind: 'table',
        columns: ['Dates', 'Nights', 'Total'],
        rows: [['23 to 26 Oct', '3', '5600 pesos']],
      },
    }),
  ]);
  assert(pricingValues.includes(5600));
  assert(pricingValues.includes(3));
  assert(factsText.includes('23 to 26 Oct'));
});

Deno.test(
  'aggregateGuardFacts - a checklist item past the first is still grounded (regression)',
  () => {
    // get_my_stay only puts the FIRST pending item in spokenText; a reply naming a later item's
    // amount must not be flagged as an ungrounded number.
    const { pricingValues, factsText } = aggregateGuardFacts([
      result({
        spokenText: 'Your booking is ready for checkin. Next: Approved GAF.',
        richCard: {
          kind: 'checklist',
          title: 'Next steps',
          items: ['Approved GAF', 'Balance due 2500 pesos', 'Security deposit refund form'],
        },
      }),
    ]);
    assert(
      pricingValues.includes(2500),
      `expected 2500 to be grounded: ${pricingValues.join(',')}`
    );
    assert(factsText.includes('Security deposit refund form'));
  }
);

Deno.test('aggregateGuardFacts - a map card contributes its href but not a stray number', () => {
  const { factsText } = aggregateGuardFacts([
    result({
      spokenText: 'Here is the location.',
      richCard: {
        kind: 'map',
        href: 'https://maps.google.com/?q=14.1,121.0',
        label: 'The property',
      },
    }),
  ]);
  assert(factsText.includes('https://maps.google.com/?q=14.1,121.0'));
});

Deno.test('toolsFor - a staff Suggest actor never sees handoff or guest-write tools', () => {
  const tools = toolsFor(baseInput('staff'));
  const names = tools.map((t) => t.name);
  assert(!names.includes('handoff_to_host'), 'staff must not see handoff_to_host');
  assert(
    !names.includes('report_maintenance_issue'),
    'staff must not see report_maintenance_issue'
  );
  assert(names.includes('get_my_stay'), 'staff should still see read tools');
});

Deno.test('toolsFor - a guest (system / undefined actor) sees every declared tool', () => {
  for (const actorType of [undefined, 'system' as const]) {
    const tools = toolsFor(baseInput(actorType));
    const names = tools.map((t) => t.name);
    assert(names.includes('handoff_to_host'));
    assert(names.includes('report_maintenance_issue'));
  }
});

Deno.test('GUEST_HANDOFF_FALLBACK_REPLY is non-empty', () => {
  assert(GUEST_HANDOFF_FALLBACK_REPLY.trim().length > 0);
});

Deno.test(
  'toolsFor - guest_actions off strips write tools from a guest actor but keeps handoff and reads',
  () => {
    for (const actorType of [undefined, 'system' as const]) {
      const tools = toolsFor(baseInput(actorType), { guestActionsEnabled: false });
      const names = tools.map((t) => t.name);
      assert(
        !names.includes('report_maintenance_issue'),
        'guest_actions off must strip write tools'
      );
      assert(
        !names.includes('request_booking_inquiry'),
        'guest_actions off must strip write tools'
      );
      assert(
        !names.includes('request_early_checkin_late_checkout'),
        'guest_actions off must strip write tools'
      );
      assert(names.includes('handoff_to_host'), 'guest_actions off must not strip handoff');
      assert(names.includes('get_my_stay'), 'guest_actions off must not strip read tools');
    }
  }
);

Deno.test(
  'toolsFor - guest_actions off has no further effect on a staff actor (already stripped)',
  () => {
    const tools = toolsFor(baseInput('staff'), { guestActionsEnabled: false });
    const names = tools.map((t) => t.name);
    assert(!names.includes('handoff_to_host'));
    assert(!names.includes('report_maintenance_issue'));
    assert(names.includes('get_my_stay'));
  }
);

Deno.test(
  'toolsFor - guest_actions enabled (default) behaves exactly as before for every actor',
  () => {
    for (const actorType of [undefined, 'system' as const]) {
      const tools = toolsFor(baseInput(actorType), { guestActionsEnabled: true });
      const names = tools.map((t) => t.name);
      assert(names.includes('report_maintenance_issue'));
      assert(names.includes('handoff_to_host'));
    }
  }
);

Deno.test('safeModelPartsForRound uses the real modelParts when every raw call is answered', () => {
  const calls = [
    { name: 'get_property_facts', arguments: {} },
    { name: 'get_parking_facts', arguments: {} },
  ];
  const realParts = [
    { functionCall: { name: 'get_property_facts', args: {} }, thoughtSignature: 'sig-1' },
    { functionCall: { name: 'get_parking_facts', args: {} }, thoughtSignature: 'sig-2' },
  ];
  const picked = safeModelPartsForRound(realParts, 2, calls);
  assertEquals(picked, realParts);
});

Deno.test(
  'safeModelPartsForRound falls back to a synthetic 1:1 reconstruction when a raw call was ' +
    'filtered out (unknown tool name) or truncated by the per-round cap',
  () => {
    const calls = [{ name: 'get_property_facts', arguments: { x: 1 } }];
    const realPartsForThreeRawCalls = [
      { functionCall: { name: 'get_property_facts', args: { x: 1 } }, thoughtSignature: 'sig-1' },
      { functionCall: { name: 'some_unknown_tool', args: {} }, thoughtSignature: 'sig-2' },
      { functionCall: { name: 'get_parking_facts', args: {} }, thoughtSignature: 'sig-3' },
    ];
    // Model actually made 3 raw calls, but only 1 survived the guest-tool filter — resending the
    // real modelParts here would leave 2 functionCalls in history with no functionResponse.
    const picked = safeModelPartsForRound(realPartsForThreeRawCalls, 3, calls);
    assertEquals(picked, [{ functionCall: { name: 'get_property_facts', args: { x: 1 } } }]);
  }
);

Deno.test('safeModelPartsForRound falls back when Gemini returned no modelParts at all', () => {
  const calls = [{ name: 'get_my_stay', arguments: {} }];
  const picked = safeModelPartsForRound(undefined, 1, calls);
  assertEquals(picked, [{ functionCall: { name: 'get_my_stay', args: {} } }]);
});
