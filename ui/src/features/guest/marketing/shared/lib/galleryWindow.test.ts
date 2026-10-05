import { describe, expect, it } from 'vitest';

import {
  cardEntranceDelay,
  galleryIndicesToMount,
} from '@/features/guest/marketing/shared/lib/galleryWindow';

describe('galleryIndicesToMount', () => {
  it('mounts only the current slide before any intent', () => {
    expect([...galleryIndicesToMount(5, 0, new Set(), false)]).toEqual([0]);
  });

  it('adds both neighbours (wrapping) once warm', () => {
    expect([...galleryIndicesToMount(5, 0, new Set(), true)].sort()).toEqual([0, 1, 4]);
  });

  it('keeps visited slides mounted', () => {
    expect([...galleryIndicesToMount(5, 3, new Set([0, 1]), false)].sort()).toEqual([0, 1, 3]);
  });

  it('handles empty and single-image galleries', () => {
    expect(galleryIndicesToMount(0, 0, new Set(), true).size).toBe(0);
    expect([...galleryIndicesToMount(1, 0, new Set(), true)]).toEqual([0]);
  });
});

describe('cardEntranceDelay', () => {
  it('caps the stagger', () => {
    expect(cardEntranceDelay(0)).toBe(0);
    expect(cardEntranceDelay(3)).toBeCloseTo(0.15);
    expect(cardEntranceDelay(47)).toBeCloseTo(0.4);
  });
});
