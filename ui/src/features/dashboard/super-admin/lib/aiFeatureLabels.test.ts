import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AI_FEATURE_LABEL_KEYS, labelAiFeature } from './aiFeatureLabels';

const EDGE_MODEL_ROUTER = readFileSync(
  join(__dirname, '../../../../../../supabase/functions/_shared/aiModelRouter.ts'),
  'utf8'
);

function edgeAiFeatures(): string[] {
  const block = EDGE_MODEL_ROUTER.match(/export const AI_FEATURES = \[([\s\S]*?)\] as const/);
  if (!block) throw new Error('AI_FEATURES not found in aiModelRouter.ts');
  return Array.from(block[1].matchAll(/'([a-z_]+)'/g), (m) => m[1]);
}

describe('aiFeatureLabels', () => {
  it('has a label for every server AI feature', () => {
    const features = edgeAiFeatures();
    expect(features.length).toBeGreaterThan(10);
    expect(features.filter((f) => !AI_FEATURE_LABEL_KEYS.includes(f))).toEqual([]);
  });

  it('falls back to spaced words for an unknown key', () => {
    expect(labelAiFeature('some_new_feature')).toBe('some new feature');
  });
});
