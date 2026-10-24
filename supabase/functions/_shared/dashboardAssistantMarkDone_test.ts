import { unwrapConfirmPayload } from './dashboardAssistantConfirmBlocks.ts';
import {
  parseMarkMaintenanceDoneQuery,
  pickOpenMaintenanceItem,
} from './dashboardAssistantMarkDone.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('parseMarkMaintenanceDoneQuery reads mark-done phrasing', () => {
  assert(
    parseMarkMaintenanceDoneQuery('Mark the leaking faucet done') === 'leaking faucet',
    'leaking faucet'
  );
  assert(
    parseMarkMaintenanceDoneQuery('mark leaking faucet as complete') === 'leaking faucet',
    'as complete'
  );
  assert(parseMarkMaintenanceDoneQuery('What maintenance is still open?') === null, 'list only');
});

Deno.test('pickOpenMaintenanceItem matches a unique open label', () => {
  const results = [
    [
      { id: 'a', label: 'Leaking faucet', completedAt: null },
      { id: 'b', label: 'AC filter', completedAt: '2026-10-01' },
    ],
  ];
  const hit = pickOpenMaintenanceItem(results, 'leaking faucet');
  assert(hit?.id === 'a', 'open leaking faucet');
  assert(pickOpenMaintenanceItem(results, 'AC filter') === null, 'already done');
  assert(pickOpenMaintenanceItem(results, 'window') === null, 'no match');
});

Deno.test('unwrapConfirmPayload lifts nested propose payload', () => {
  const lifted = unwrapConfirmPayload({
    summary: 'Mark Leaking faucet done.',
    payload: {
      id: 'a',
      propertyId: 'p',
      patch: { completed_at: '2026-10-19T00:00:00.000Z' },
    },
  });
  assert(lifted.id === 'a', 'id');
  assert(lifted.propertyId === 'p', 'propertyId');
  assert(
    lifted.patch &&
      typeof lifted.patch === 'object' &&
      (lifted.patch as { completed_at?: string }).completed_at === '2026-10-19T00:00:00.000Z',
    'patch'
  );
});
