import { describe, expect, it } from 'vitest';

import { textSlotsForSceneKind, isVideoTextSlotId, defaultTextLayoutForSceneKind, resolveTextSlotPosition, normalizeSceneTextLayout, slotPreviewText } from '@/features/dashboard/marketing/lib/video/videoTextSlots';

describe('textSlotsForSceneKind', () => {

  it('textSlotsForSceneKind is exported', () => {
    expect(typeof textSlotsForSceneKind).toBe('function');
  });

});

describe('isVideoTextSlotId', () => {

  it('isVideoTextSlotId is exported', () => {
    expect(typeof isVideoTextSlotId).toBe('function');
  });

});

describe('defaultTextLayoutForSceneKind', () => {

  it('defaultTextLayoutForSceneKind is exported', () => {
    expect(typeof defaultTextLayoutForSceneKind).toBe('function');
  });

});

describe('resolveTextSlotPosition', () => {

  it('resolveTextSlotPosition is exported', () => {
    expect(typeof resolveTextSlotPosition).toBe('function');
  });

});

describe('normalizeSceneTextLayout', () => {

  it('normalizeSceneTextLayout is exported', () => {
    expect(typeof normalizeSceneTextLayout).toBe('function');
  });

});

describe('slotPreviewText', () => {

  it('slotPreviewText is exported', () => {
    expect(typeof slotPreviewText).toBe('function');
  });

});
