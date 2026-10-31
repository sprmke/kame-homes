import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  imageTierOptions,
  videoTierOptions,
  imageSizeOptions,
  maxReferencesForTier,
  VIDEO_CAMERA_MOVES,
  VIDEO_MAX_REFERENCES,
  VIDEO_PHOTO_DEFAULT_PROMPT,
  VIDEO_SOUND_MODES,
  GENERATION_LOOKS,
  MAX_LOOK_SUFFIX_CHARS,
  composeGenerationPrompt,
  splitGenerationPrompt,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';

const EDGE_VIDEO_PROMPT_BUILDER = readFileSync(
  join(__dirname, '../../../../../..', 'supabase/functions/_shared/marketingVideoPromptBuilder.ts'),
  'utf8'
);

/** String literals inside `export const NAME = [ ... ] as const` in the edge module. */
function edgeConstList(name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(
    EDGE_VIDEO_PROMPT_BUILDER
  );
  if (!match) throw new Error(`${name} not found in marketingVideoPromptBuilder.ts`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe('video options mirror the edge prompt builder', () => {
  it('camera moves', () => {
    expect(VIDEO_CAMERA_MOVES.map((move) => move.id)).toEqual(
      edgeConstList('VIDEO_CAMERA_MOVE_IDS')
    );
  });

  it('sound modes', () => {
    expect(VIDEO_SOUND_MODES.map((mode) => mode.value)).toEqual(edgeConstList('VIDEO_SOUND_MODES'));
  });

  it('photo-only default prompt', () => {
    expect(EDGE_VIDEO_PROMPT_BUILDER).toContain(
      `VIDEO_PHOTO_DEFAULT_PROMPT = '${VIDEO_PHOTO_DEFAULT_PROMPT}'`
    );
  });

  it('a video starts from one photo', () => {
    expect(VIDEO_MAX_REFERENCES).toBe(1);
  });
});

describe('imageTierOptions', () => {
  it('imageTierOptions is exported', () => {
    expect(typeof imageTierOptions).toBe('function');
  });
});

describe('videoTierOptions', () => {
  it('videoTierOptions is exported', () => {
    expect(typeof videoTierOptions).toBe('function');
  });
});

describe('imageSizeOptions', () => {
  it('imageSizeOptions is exported', () => {
    expect(typeof imageSizeOptions).toBe('function');
  });
});

describe('maxReferencesForTier', () => {
  it('maxReferencesForTier is exported', () => {
    expect(typeof maxReferencesForTier).toBe('function');
  });
});

describe('generation looks', () => {
  it('round-trips a description and look through the sent prompt', () => {
    const look = GENERATION_LOOKS[0]!;
    const prompt = composeGenerationPrompt('  Pool deck at dusk ', look.id);
    expect(prompt.startsWith('Pool deck at dusk')).toBe(true);
    expect(splitGenerationPrompt(prompt)).toEqual({ description: 'Pool deck at dusk', look });
  });

  it('sends the description alone when no look is picked', () => {
    expect(composeGenerationPrompt('Bedroom ', null)).toBe('Bedroom');
    expect(splitGenerationPrompt('Bedroom')).toEqual({ description: 'Bedroom', look: null });
  });

  it('leaves unknown style suffixes in the description', () => {
    const prompt = 'Bedroom\n\nStyle: something custom';
    expect(splitGenerationPrompt(prompt)).toEqual({ description: prompt, look: null });
  });

  it('reserves room for the longest look', () => {
    for (const look of GENERATION_LOOKS) {
      expect(composeGenerationPrompt('x', look.id).length - 1).toBeLessThanOrEqual(
        MAX_LOOK_SUFFIX_CHARS
      );
    }
  });
});
