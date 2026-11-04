import { describe, expect, it } from 'vitest';

import { isReloadShortcut } from '@/lib/unsavedChanges/reloadShortcut';

describe('isReloadShortcut', () => {
  it('matches F5 and modifier + R', () => {
    expect(isReloadShortcut({ key: 'F5' })).toBe(true);
    expect(isReloadShortcut({ key: 'r', ctrlKey: true })).toBe(true);
    expect(isReloadShortcut({ key: 'r', metaKey: true })).toBe(true);
    expect(isReloadShortcut({ key: 'R', ctrlKey: true })).toBe(true);
  });

  it('ignores typing R without a refresh modifier', () => {
    expect(isReloadShortcut({ key: 'r' })).toBe(false);
    expect(isReloadShortcut({ key: 'r', shiftKey: true })).toBe(false);
    expect(isReloadShortcut({ key: 'Enter', ctrlKey: true })).toBe(false);
  });
});
