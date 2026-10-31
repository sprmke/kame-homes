#!/usr/bin/env bun
/**
 * Diff the live `pricing_plans` catalog against the golden tier matrix used by the plan tests.
 *
 * Usage: bun run check:plan-catalog          (local Supabase, after `bun run db:reset`)
 *        PLAN_CATALOG_ALLOW_REMOTE=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run check:plan-catalog
 *
 * Read-only. Exits 1 on any difference. Golden data: ui/src/features/dashboard/plans/lib/planTierGolden.ts
 * Fix a diff by updating the seed migration (new file, never edit a shipped one) or the golden file,
 * plus docs/architecture/plans-feature-matrix.md, in the same change.
 */

import { createClient } from '@supabase/supabase-js';

import { parsePlanFeatures } from '../../supabase/functions/_shared/planFeatures';
import {
  GOLDEN_ALL_PLANS,
  type GoldenPlan,
} from '../../ui/src/features/dashboard/plans/lib/planTierGolden';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
if (!isLocal && process.env.PLAN_CATALOG_ALLOW_REMOTE !== '1') {
  console.error(
    `Refusing to read ${url}. Set PLAN_CATALOG_ALLOW_REMOTE=1 to check a hosted project.`
  );
  process.exit(2);
}

// Public local-stack demo key; hosted projects must pass their own via env.
const LOCAL_DEMO_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  (isLocal ? LOCAL_DEMO_SERVICE_KEY : '');
if (!key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY for the remote project.');
  process.exit(2);
}

const supabase = createClient(url, key);

type Row = {
  code: string;
  name: string;
  sort_order: number;
  price_php: number | null;
  discount_percent: number;
  volume_discount_tiers: unknown;
  is_active: boolean;
  is_default: boolean;
  pricing_model: string;
  features: unknown;
};

const { data, error } = await supabase
  .from('pricing_plans')
  .select(
    'code, name, sort_order, price_php, discount_percent, volume_discount_tiers, is_active, is_default, pricing_model, features'
  )
  .eq('pricing_model', 'subscription');

if (error) {
  console.error(`Could not read pricing_plans: ${error.message}`);
  process.exit(2);
}

const rows = new Map((data as Row[]).map((row) => [row.code, row]));
const problems: string[] = [];

function expectEqual(where: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    problems.push(`${where}: db=${JSON.stringify(actual)} golden=${JSON.stringify(expected)}`);
  }
}

function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)])
    ) as T;
  }
  return value;
}

function checkPlan(golden: GoldenPlan) {
  const row = rows.get(golden.code);
  if (!row) {
    problems.push(`${golden.code}: missing from pricing_plans`);
    return;
  }
  expectEqual(`${golden.code}.name`, row.name, golden.displayName);
  expectEqual(`${golden.code}.sort_order`, Number(row.sort_order), golden.sortOrder);
  expectEqual(`${golden.code}.price_php`, Number(row.price_php ?? 0), golden.pricePhp);
  expectEqual(
    `${golden.code}.discount_percent`,
    Number(row.discount_percent),
    golden.discountPercent
  );
  expectEqual(`${golden.code}.is_active`, row.is_active, golden.isActive);
  expectEqual(`${golden.code}.is_default`, row.is_default, golden.isDefault);
  expectEqual(
    `${golden.code}.volume_discount_tiers`,
    row.volume_discount_tiers,
    golden.volumeDiscountTiers
  );

  // Compare as the server reads them, so legacy/missing keys normalise the same way on both sides.
  const dbFeatures = sortKeys(parsePlanFeatures(row.features));
  const goldenFeatures = sortKeys(parsePlanFeatures(golden.features));
  for (const featureKey of Object.keys(goldenFeatures) as Array<keyof typeof goldenFeatures>) {
    expectEqual(
      `${golden.code}.features.${featureKey}`,
      dbFeatures[featureKey],
      goldenFeatures[featureKey]
    );
  }
}

for (const golden of GOLDEN_ALL_PLANS) checkPlan(golden);

const goldenCodes = new Set(GOLDEN_ALL_PLANS.map((p) => p.code));
for (const row of rows.values()) {
  // Commission is a retired parallel model; every other unknown subscription row is drift.
  if (!goldenCodes.has(row.code))
    problems.push(`${row.code}: in pricing_plans but not in the golden catalog`);
}

const activeCodes = [...rows.values()]
  .filter((row) => row.is_active)
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((row) => row.code);
expectEqual(
  'active subscription ladder (what /for-hosts/pricing serves)',
  activeCodes,
  GOLDEN_ALL_PLANS.filter((p) => p.isActive).map((p) => p.code)
);

if (problems.length > 0) {
  console.error(`Plan catalog drift (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Plan catalog matches the golden matrix (${GOLDEN_ALL_PLANS.length} plans, ${url}).`);
