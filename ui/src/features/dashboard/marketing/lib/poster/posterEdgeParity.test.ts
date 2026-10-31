/**
 * The poster director (Deno edge) and the poster compiler (UI) share three enums:
 * archetypes, font pairings and goals. The edge module can't be imported here
 * (Deno https imports), so this reads its source and compares the literal arrays.
 * If the model is offered an archetype the compiler doesn't know, every such
 * variant silently falls back to the default layout.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { POSTER_FONT_PAIRING_IDS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const REPO_ROOT = join(__dirname, '../../../../../../..');
const EDGE_SOURCE = readFileSync(
  join(REPO_ROOT, 'supabase/functions/_shared/marketingPosterDirector.ts'),
  'utf8'
);

function edgeArray(name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(EDGE_SOURCE);
  if (!match) throw new Error(`${name} not found in marketingPosterDirector.ts`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((item) => item[1]!);
}

describe('poster enums: UI compiler ↔ edge director', () => {
  it('archetypes match', () => {
    expect(edgeArray('POSTER_ARCHETYPES')).toEqual([...POSTER_ARCHETYPE_IDS]);
  });

  it('font pairings match', () => {
    expect(edgeArray('POSTER_FONT_PAIRINGS')).toEqual([...POSTER_FONT_PAIRING_IDS]);
  });

  it('goals match', () => {
    expect(edgeArray('POSTER_GOALS')).toEqual([...POSTER_GOALS]);
  });
});
