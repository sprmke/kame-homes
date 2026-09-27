import { describe, expect, it } from 'vitest';

import {
  MAX_LETTER_STEP,
  buildWordmarkWave,
  type WordmarkWord,
} from '@/components/branding/appLoaderWordmark';

function flatSteps(words: WordmarkWord[]): number[] {
  return words.flatMap((word) => word.chunks.map((chunk) => chunk.step));
}

function flatText(words: WordmarkWord[]): string[] {
  return words.flatMap((word) => word.chunks.map((chunk) => chunk.text));
}

describe('buildWordmarkWave', () => {
  it('splits a short name per letter and staggers across both words', () => {
    const words = buildWordmarkWave({ primary: 'Kame', accent: 'Homes' });

    expect(flatText(words)).toEqual(['K', 'a', 'm', 'e', 'H', 'o', 'm', 'e', 's']);
    expect(flatSteps(words)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(words.map((word) => word.accent)).toEqual([false, true]);
  });

  it('drops the accent word when the name is a single word', () => {
    const words = buildWordmarkWave({ primary: 'Kame', accent: '' });

    expect(words).toHaveLength(1);
    expect(flatText(words)).toEqual(['K', 'a', 'm', 'e']);
  });

  it('waves per word once the name is too long for a per-letter stagger', () => {
    const words = buildWordmarkWave({
      primary: 'Sunrise',
      accent: 'Coastal Residences Management Group',
    });

    expect(flatText(words)).toEqual(['Sunrise', 'Coastal Residences Management Group']);
    expect(flatSteps(words)).toEqual([0, 1]);
  });

  it('caps the stagger step so the wave still clears one cycle', () => {
    const words = buildWordmarkWave({ primary: 'Abcdefghijklmnopqrst', accent: 'Uv' });

    expect(Math.max(...flatSteps(words))).toBe(MAX_LETTER_STEP);
  });

  it('keeps an astral glyph as one chunk', () => {
    const words = buildWordmarkWave({ primary: '🏠K', accent: '' });

    expect(flatText(words)).toEqual(['🏠', 'K']);
  });

  it('returns no words when the platform name is unset', () => {
    expect(buildWordmarkWave({ primary: '', accent: '' })).toEqual([]);
  });
});
