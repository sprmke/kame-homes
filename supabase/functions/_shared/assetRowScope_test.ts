/**
 * assetRowScope — pure-logic coverage for the guard clause only (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/assetRowScope_test.ts
 *
 * assertAssetRowInScope has two phases: (1) a synchronous guard clause that 404s on a
 * structurally-invalid call before any query is built, and (2) a service-role DB lookup that
 * proves the id/recurrence-series-id actually belongs to the caller's property/parking. Phase 2
 * needs a live Supabase instance (createServiceClient() is a module-level singleton with no
 * injection seam — see cronSecretGate_test.ts / activityLog_test.ts for the same constraint on
 * other DB-touching shared modules) and is exercised today via ./dev.sh manual QA per
 * docs/workflow/for-testing/ai-llm-best-practices-hardening.md's "owner with a foreign propertyId
 * → 404" checklist item, not by a Deno unit test. This file covers what phase 1 guarantees on its
 * own: a call missing scope or missing a target id can never reach the database at all, so the
 * worst a caller can do by omitting either is a clean 404, never an unscoped table scan.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { assertAssetRowInScope } from './assetRowScope.ts';
import { EdgeError } from './httpResponse.ts';

const ID = '00000000-0000-0000-0000-0000000000e5';
const PROPERTY = '00000000-0000-0000-0000-0000000000f6';

async function assertNotFoundBeforeAnyQuery(
  options: Parameters<typeof assertAssetRowInScope>[0]
): Promise<void> {
  try {
    await assertAssetRowInScope(options);
    throw new Error('expected assertAssetRowInScope to throw');
  } catch (err) {
    if (!(err instanceof EdgeError)) throw err;
    assertEquals(err.status, 404, 'must be 404, never 403 — foreign ids must not be enumerable');
    assertEquals(err.code, 'asset_row_not_found');
  }
}

Deno.test(
  'assertAssetRowInScope — no propertyId and no parkingId is a 404 before any query',
  async () => {
    await assertNotFoundBeforeAnyQuery({ table: 'finance_line_items', scope: {}, id: ID });
  }
);

Deno.test(
  'assertAssetRowInScope — neither id nor recurrenceSeriesId is a 404 before any query',
  async () => {
    await assertNotFoundBeforeAnyQuery({
      table: 'finance_line_items',
      scope: { propertyId: PROPERTY },
    });
  }
);

Deno.test(
  'assertAssetRowInScope — empty-string scope ids are treated as absent, not a valid scope',
  async () => {
    await assertNotFoundBeforeAnyQuery({
      table: 'maintenance_items',
      scope: { propertyId: '', parkingId: '' },
      id: ID,
    });
  }
);
