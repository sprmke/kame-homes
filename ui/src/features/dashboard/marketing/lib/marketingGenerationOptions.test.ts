import { describe, expect, it } from 'vitest';

import {
  imageTierOptions,
  videoTierOptions,
  imageSizeOptions,
  maxReferencesForTier,
  VIDEO_MAX_REFERENCES,
  GENERATION_LOOKS,
  MAX_LOOK_SUFFIX_CHARS,
  composeGenerationPrompt,
  splitGenerationPrompt,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';

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

describe('VIDEO_MAX_REFERENCES', () => {
  it('is defined', () => {
    expect(VIDEO_MAX_REFERENCES).toBeDefined();
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
