/**
 * The review category/tag catalog exists twice: UI (`reviewCatalog.ts`) and
 * edge (`supabase/functions/_shared/reviewCategories.ts`). The edge module
 * can't be imported here (Deno), so this compares the literal arrays in its
 * source. A mismatch means the guest/host review form could collect a
 * category or tag id the server doesn't recognize, or vice versa.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GUEST_REVIEW_CATEGORY_IDS,
  HOST_REVIEW_CATEGORY_IDS,
  HOST_REVIEW_ISSUE_TAG_IDS,
  HOST_REVIEW_STRENGTH_TAG_IDS,
  MAX_HOST_REVIEW_TAGS,
} from '@/features/reviews/lib/reviewCatalog';

const REPO_ROOT = join(__dirname, '../../../../..');
const EDGE_SOURCE = readFileSync(
  join(REPO_ROOT, 'supabase/functions/_shared/reviewCategories.ts'),
  'utf8'
);

function edgeArray(name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(EDGE_SOURCE);
  if (!match) throw new Error(`${name} not found in edge reviewCategories.ts`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((item) => item[1]!);
}

function edgeConst(name: string): number {
  const match = new RegExp(`export const ${name} = (\\d+)`).exec(EDGE_SOURCE);
  if (!match) throw new Error(`${name} not found in edge reviewCategories.ts`);
  return Number(match[1]);
}

describe('review catalog: UI ↔ edge', () => {
  it('guest category ids match (D9: all 6 required)', () => {
    expect(edgeArray('GUEST_REVIEW_CATEGORY_IDS')).toEqual([...GUEST_REVIEW_CATEGORY_IDS]);
    expect(GUEST_REVIEW_CATEGORY_IDS.length).toBe(6);
  });

  it('host category ids match', () => {
    expect(edgeArray('HOST_REVIEW_CATEGORY_IDS')).toEqual([...HOST_REVIEW_CATEGORY_IDS]);
  });

  it('host strength and issue tag ids match', () => {
    expect(edgeArray('HOST_REVIEW_STRENGTH_TAG_IDS')).toEqual([...HOST_REVIEW_STRENGTH_TAG_IDS]);
    expect(edgeArray('HOST_REVIEW_ISSUE_TAG_IDS')).toEqual([...HOST_REVIEW_ISSUE_TAG_IDS]);
  });

  it('max host review tags matches', () => {
    expect(edgeConst('MAX_HOST_REVIEW_TAGS')).toBe(MAX_HOST_REVIEW_TAGS);
  });
});
