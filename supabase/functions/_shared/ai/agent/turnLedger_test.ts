import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { TurnLedger } from './turnLedger.ts';

const isWrite = (name: string) => name.startsWith('propose_') || name.startsWith('set_');

Deno.test('a single write in a round with only that call is not escalated', () => {
  const ledger = new TurnLedger();
  assertEquals(ledger.planRound(['set_price'], isWrite), false);
});

Deno.test('a read-only round never escalates', () => {
  const ledger = new TurnLedger();
  assertEquals(ledger.planRound(['list_bookings', 'get_booking'], isWrite), false);
});

Deno.test('two writes in one round escalate', () => {
  const ledger = new TurnLedger();
  assert(ledger.planRound(['set_price', 'set_block'], isWrite));
});

Deno.test('a write sharing a round with a read escalates', () => {
  const ledger = new TurnLedger();
  assert(ledger.planRound(['get_booking', 'set_price'], isWrite));
});

Deno.test('writes spread over two rounds escalate the second (turn-level, not per round)', () => {
  const ledger = new TurnLedger();
  assertEquals(ledger.planRound(['set_price'], isWrite), false);
  assertEquals(ledger.planRound(['list_bookings'], isWrite), false);
  assert(ledger.planRound(['set_block'], isWrite));
  assertEquals(ledger.totalWriteCalls, 2);
});

Deno.test('reading guest-written text escalates every later write for the rest of the turn', () => {
  const ledger = new TurnLedger();
  ledger.markUntrustedRead();
  assert(ledger.planRound(['set_price'], isWrite));
  assert(ledger.untrustedContentRead);
});

Deno.test(
  'a read-only round after an untrusted read still reports escalation (flag is set before any later write)',
  () => {
    const ledger = new TurnLedger();
    ledger.markUntrustedRead();
    // The flag only matters to writes, but it stays set so a write added later is escalated.
    assert(ledger.planRound(['list_bookings'], isWrite));
  }
);

Deno.test('proposals keep call order', () => {
  const ledger = new TurnLedger<string>();
  ledger.addProposal({ toolName: 'a', result: '1' });
  ledger.addProposal({ toolName: 'b', result: '2' });
  assertEquals(
    ledger.proposals.map((p) => p.toolName),
    ['a', 'b']
  );
});
