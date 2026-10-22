/**
 * The theme parser exists twice: UI (`marketingTheme.ts`) and edge
 * (`supabase/functions/_shared/marketingTheme.ts`). The edge module can't be
 * imported here (Deno), so this compares the literal arrays in its source. A
 * mismatch means the editor could save a theme the server rejects (or worse,
 * accept one the editor can't draw).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GENERATION_LOOKS } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  MARKETING_THEME_BACKGROUNDS,
  MARKETING_THEME_CORNERS,
  MARKETING_THEME_PALETTE_ROLES,
  MARKETING_THEME_PHOTO_LOOKS,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { MARKETING_THEME_FONT_FAMILIES } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import {
  BUILTIN_PROPERTY_COLORS_THEME_KEY,
  starterThemeKey,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';
import { listStarterThemes } from '@/features/dashboard/marketing/lib/theme/starterThemes';

const REPO_ROOT = join(__dirname, '../../../../../../..');
const EDGE_SOURCE = readFileSync(
  join(REPO_ROOT, 'supabase/functions/_shared/marketingTheme.ts'),
  'utf8'
);

function edgeArray(name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(EDGE_SOURCE);
  if (!match) throw new Error(`${name} not found in edge marketingTheme.ts`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((item) => item[1]!);
}

function edgeBuiltinKeyRe(): RegExp {
  const match = /export const BUILTIN_THEME_KEY_RE = \/(.+)\/;/.exec(EDGE_SOURCE);
  if (!match) throw new Error('BUILTIN_THEME_KEY_RE not found');
  return new RegExp(match[1]!);
}

describe('marketing theme: UI ↔ edge', () => {
  it('backgrounds, corners and palette roles match', () => {
    expect(edgeArray('MARKETING_THEME_BACKGROUNDS')).toEqual([...MARKETING_THEME_BACKGROUNDS]);
    expect(edgeArray('MARKETING_THEME_CORNERS')).toEqual([...MARKETING_THEME_CORNERS]);
    expect(edgeArray('MARKETING_THEME_PALETTE_ROLES')).toEqual([...MARKETING_THEME_PALETTE_ROLES]);
  });

  it('photo looks match the edge and the AI Photo / Video look list', () => {
    expect(edgeArray('MARKETING_THEME_PHOTO_LOOKS')).toEqual([...MARKETING_THEME_PHOTO_LOOKS]);
    expect(GENERATION_LOOKS.map((look) => look.id)).toEqual([...MARKETING_THEME_PHOTO_LOOKS]);
  });

  it('font allow-list matches', () => {
    expect(edgeArray('MARKETING_THEME_FONT_FAMILIES')).toEqual([...MARKETING_THEME_FONT_FAMILIES]);
  });

  it('every built-in key the UI can send is accepted by the edge', () => {
    const re = edgeBuiltinKeyRe();
    expect(re.test(BUILTIN_PROPERTY_COLORS_THEME_KEY)).toBe(true);
    for (const starter of listStarterThemes()) {
      expect(re.test(starterThemeKey(starter.id)), starter.id).toBe(true);
    }
  });
});
