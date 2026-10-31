/**
 * Offline answer-quality coverage from hydrators. Fixture-backed `intent: answer` rows
 * should already surface rubric facts in host-visible blocks even when the model only
 * wrote a one-line lead. Live `eval:ai --suite quality` still uses the model.
 */
import './evalEnv.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { shapeAndFinalizeForEval } from '../../_shared/dashboardAssistantResponseShape.ts';
import { scoreAnswerQuality } from './answerQualityScore.ts';
import { groundingTextFor, resolveFixtures } from './assistantBlockShape.ts';
import { readJsonl } from './evalDatasets.ts';
import type { AnswerQualityRow } from './evalRowTypes.ts';

const LEAD = 'Here is what I found.';

Deno.test('hydrators cover 90% of fixture-backed quality rows without a live model', async () => {
  const rows = (await readJsonl<AnswerQualityRow>('assistant_answer_quality.jsonl')).filter(
    (row) => row.rubric.intent === 'answer' && row.fixtures.length > 0
  );
  assert(rows.length >= 30, `expected fixture-backed answer rows, got ${rows.length}`);
  const misses: string[] = [];
  for (const row of rows) {
    const fixtures = await resolveFixtures(row.fixtures);
    const toolResults = fixtures.map((fixture) => fixture.data);
    const blocks = shapeAndFinalizeForEval({
      modelBlocks: [{ type: 'text', text: LEAD }],
      toolResults,
      groundingText: groundingTextFor(row.message, toolResults),
      userMessage: row.message,
    });
    const score = scoreAnswerQuality(blocks, row.rubric);
    if (!score.pass) misses.push(`${row.id}: ${score.problems.join('; ')}`);
  }
  const rate = (rows.length - misses.length) / rows.length;
  assertEquals(
    rate >= 0.9,
    true,
    `hydrator quality ${Math.round(rate * 100)}% (${rows.length - misses.length}/${rows.length})\n${misses.join('\n')}`
  );
});
