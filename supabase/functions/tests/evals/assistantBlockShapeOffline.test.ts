/**
 * Offline block-shape evals — deterministic, no network. Each row in
 * datasets/assistant_block_shape.jsonl feeds fixture tool results + stand-in model blocks through
 * the exact shaping pipeline the handler uses (`dashboardAssistantResponseShape.ts`) and asserts
 * the host-visible shape (primary block, chip count, text budget, humanized labels, grounding).
 *
 * Rows marked `pending: "phase-N"` document a target shape that depends on a later phase of the
 * AI companion plan; they are validated for structure and skipped for scoring until the flag is
 * removed. Live, model-produced version: `bun run eval:ai -- --suite blocks`.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { ASSISTANT_TOOL_MODULES } from '../../_shared/dashboardAssistantToolRouter.ts';
import { KNOWN_BLOCK_TYPES } from '../../_shared/dashboardAssistantSafetyGuard.ts';
import {
  loadFixtureFile,
  readBlockShapeRows,
  resolveFixtures,
  runBlockShapeRowOffline,
} from './assistantBlockShape.ts';

const PENDING_PHASES = new Set(['phase-2', 'phase-3', 'phase-4']);
const rows = await readBlockShapeRows();
const knownModules = new Set<string>([...Object.values(ASSISTANT_TOOL_MODULES), 'core']);

Deno.test('block-shape dataset is well-formed', async () => {
  assert(rows.length >= 40, `expected at least 40 rows, got ${rows.length}`);
  const ids = new Set(rows.map((row) => row.id));
  assertEquals(ids.size, rows.length, 'duplicate ids');
  for (const row of rows) {
    assert(row.message.trim().length > 0, `${row.id}: empty message`);
    assert(knownModules.has(row.module), `${row.id}: unknown module ${row.module}`);
    assert(Array.isArray(row.modelBlocks), `${row.id}: modelBlocks must be an array`);
    assert(row.expect && typeof row.expect === 'object', `${row.id}: missing expect`);
    if (row.pending) assert(PENDING_PHASES.has(row.pending), `${row.id}: bad pending tag`);
    // Fixture refs must resolve and every fixture must name its tool.
    const fixtures = await resolveFixtures(row.fixtures);
    for (const fixture of fixtures) {
      assert(
        typeof fixture.toolName === 'string' && fixture.toolName,
        `${row.id}: fixture toolName`
      );
    }
    // A non-pending row must expect a block type the pipeline can emit today.
    if (!row.pending && row.expect.primaryBlock) {
      assert(
        KNOWN_BLOCK_TYPES.has(row.expect.primaryBlock as never),
        `${row.id}: primaryBlock ${row.expect.primaryBlock} is not a known block type; mark pending`
      );
    }
  }
});

Deno.test('block-shape fixtures name real tools', async () => {
  const knownTools = new Set(Object.keys(ASSISTANT_TOOL_MODULES));
  // Tools planned in Phase 4 of the AI companion plan; drop from this list as each ships.
  const plannedTools = new Set<string>();
  for (const file of [
    'bookings.json',
    'finance.json',
    'analytics.json',
    'operations.json',
    'knowledge.json',
  ]) {
    const table = await loadFixtureFile(file);
    for (const [key, fixture] of Object.entries(table)) {
      assert(
        knownTools.has(fixture.toolName) || plannedTools.has(fixture.toolName),
        `${file}#${key}: unknown tool ${fixture.toolName}`
      );
    }
  }
});

for (const row of rows) {
  Deno.test({
    name: `block shape [${row.id}]${row.pending ? ` (pending ${row.pending})` : ''}`,
    ignore: Boolean(row.pending),
    fn: async () => {
      const result = await runBlockShapeRowOffline(row);
      assert(
        result.pass,
        `${row.id}: ${result.failures.join('; ')}\nblocks=${JSON.stringify(result.blocks).slice(0, 800)}`
      );
    },
  });
}
