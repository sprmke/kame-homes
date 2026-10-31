import { describe, expect, it } from 'vitest';

import { SHEET_DRAG_CLOSE_DISTANCE, sheetHeightForDrag, shouldDismissSheetDrag } from './sheetDrag';

describe('sheetHeightForDrag', () => {
  it('shrinks 1:1 as the pointer moves down', () => {
    expect(sheetHeightForDrag(480, 0)).toBe(480);
    expect(sheetHeightForDrag(480, 40)).toBe(440);
    expect(sheetHeightForDrag(480, 480)).toBe(0);
    expect(sheetHeightForDrag(480, 600)).toBe(0);
  });

  it('does not grow when the pointer moves up', () => {
    expect(sheetHeightForDrag(480, -30)).toBe(480);
  });

  it('treats a non-positive start height as closed', () => {
    expect(sheetHeightForDrag(0, 10)).toBe(0);
    expect(sheetHeightForDrag(Number.NaN, 10)).toBe(0);
  });
});

describe('shouldDismissSheetDrag', () => {
  it('dismisses past the distance threshold', () => {
    expect(shouldDismissSheetDrag(SHEET_DRAG_CLOSE_DISTANCE, 0)).toBe(false);
    expect(shouldDismissSheetDrag(SHEET_DRAG_CLOSE_DISTANCE + 1, 0)).toBe(true);
  });

  it('dismisses on a downward flick even when the distance is short', () => {
    expect(shouldDismissSheetDrag(24, 701)).toBe(true);
    expect(shouldDismissSheetDrag(24, 100)).toBe(false);
  });

  it('ignores an upward flick', () => {
    expect(shouldDismissSheetDrag(-40, -900)).toBe(false);
  });
});
