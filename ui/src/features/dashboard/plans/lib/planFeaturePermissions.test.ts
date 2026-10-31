import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PLAN_FEATURE_PERMISSION_COVERAGE,
  planFeatureByPermissionLeaf,
} from '@/features/dashboard/plans/lib/planFeaturePermissions';
import { DEFAULT_PLAN_FEATURES } from '@/features/dashboard/plans/lib/planFeatures';
import { PROPERTY_PERMISSION_CATALOG } from '@/features/dashboard/team/lib/propertyPermissionCatalog';
import { TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/propertyTeamConstants';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const FUNCTIONS_DIR = resolve(ROOT, 'supabase/functions');
const EDGE_CATALOG = resolve(FUNCTIONS_DIR, '_shared/propertyTeamPermissions.ts');

const leafIds = new Set(TEAM_PERMISSIONS.map((p) => p.id));

describe('plan feature to team permission coverage', () => {
  it('covers every plan feature key (leaves or an explicit N/A reason)', () => {
    const keys = Object.keys(DEFAULT_PLAN_FEATURES).sort();
    expect(Object.keys(PLAN_FEATURE_PERMISSION_COVERAGE).sort()).toEqual(keys);
  });

  it('every mapped leaf exists in the property catalog', () => {
    for (const [feature, coverage] of Object.entries(PLAN_FEATURE_PERMISSION_COVERAGE)) {
      if (!('leaves' in coverage)) {
        expect(coverage.na.length, `${feature} needs an N/A reason`).toBeGreaterThan(0);
        continue;
      }
      for (const leaf of coverage.leaves) {
        expect(leafIds.has(leaf), `${feature} -> ${leaf}`).toBe(true);
      }
    }
  });

  it('a leaf maps to at most one plan feature', () => {
    const seen = new Map<string, string>();
    for (const [feature, coverage] of Object.entries(PLAN_FEATURE_PERMISSION_COVERAGE)) {
      if (!('leaves' in coverage)) continue;
      for (const leaf of coverage.leaves) {
        expect(seen.get(leaf), `${leaf} mapped twice`).toBeUndefined();
        seen.set(leaf, feature);
      }
    }
  });

  it('catalog nodes carry the derived plan feature', () => {
    const derived = planFeatureByPermissionLeaf();
    for (const node of PROPERTY_PERMISSION_CATALOG) {
      if (!node.id) continue;
      expect(node.planFeatureKey).toBe(derived[node.id]);
    }
  });

  it('AI marketing image and text generation are separate leaves on separate plan keys', () => {
    const derived = planFeatureByPermissionLeaf();
    expect(derived['marketing.generate.image:add']).toBe('aiMarketingImageGeneration');
    expect(derived['marketing.generate:add']).toBe('aiMarketingGeneration');
    expect(derived['marketing.generate.video:add']).toBe('aiMarketingVideoGeneration');
  });
});

describe('edge handlers only require catalogued property permissions', () => {
  it('every leaf passed to a property access helper exists in TEAM_PERMISSION_IDS', () => {
    const edgeSource = readFileSync(EDGE_CATALOG, 'utf8');
    const block = edgeSource.match(/export const TEAM_PERMISSION_IDS = \[([\s\S]*?)\] as const/);
    const edgeIds = new Set([...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));

    const callRe =
      /(?:resolveScopedPropertyAccess|verifyPropertyAccess|requirePropertyPermissionAndFeature)\(\s*(?:[^)]*?,\s*)?'([a-zA-Z.]+:[a-z]+)'/g;
    const unknown: string[] = [];
    for (const dir of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name === 'node_modules' || dir.name === 'tests') continue;
      let source: string;
      try {
        source = readFileSync(resolve(FUNCTIONS_DIR, dir.name, 'index.ts'), 'utf8');
      } catch {
        continue;
      }
      for (const match of source.matchAll(callRe)) {
        if (!edgeIds.has(match[1])) unknown.push(`${dir.name}: ${match[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});

describe('edge handlers use the dedicated leaf for credit-spending actions', () => {
  const read = (fn: string) => readFileSync(resolve(FUNCTIONS_DIR, fn, 'index.ts'), 'utf8');

  it.each([
    ['generate-marketing-media', 'marketing.generate.image:add'],
    ['upload-marketing-generation-reference', 'marketing.generate.image:add'],
    ['analytics-ai-review', 'analytics.aiReview:add'],
    ['smart-pricing-settings', 'pricing.smartPricing:edit'],
    ['smart-pricing-preview', 'pricing.smartPricing:edit'],
    ['smart-pricing-apply', 'pricing.smartPricing:edit'],
    ['dashboard-assistant-chat', 'assistant:view'],
  ])('%s requires %s', (fn, leaf) => {
    expect(read(fn)).toContain(`'${leaf}'`);
  });

  it('smart pricing no longer rides on pricing.rates:edit', () => {
    for (const fn of ['smart-pricing-preview', 'smart-pricing-apply']) {
      expect(read(fn)).not.toContain("'pricing.rates:edit'");
    }
  });
});
