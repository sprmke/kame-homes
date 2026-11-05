import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dismissIntro,
  introDismissalKey,
  isIntroDismissed,
  resetAllIntroDismissals,
  resetIntroDismissal,
} from './introDismissal';

function createStorage(overrides: Partial<Storage> = {}): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    ...overrides,
  } as Storage;
}

afterEach(() => {
  resetAllIntroDismissals();
  vi.unstubAllGlobals();
});

describe('introDismissal', () => {
  it('scopes keys by viewer, feature, and version', () => {
    expect(introDismissalKey({ userId: 'user-a', featureKey: 'pricing.smart' })).toBe(
      'kh.help.intro.user-a.pricing.smart.v1'
    );
    expect(introDismissalKey({ userId: 'user-b', featureKey: 'pricing.smart', version: 2 })).toBe(
      'kh.help.intro.user-b.pricing.smart.v2'
    );
    expect(introDismissalKey({ userId: null, featureKey: 'inbox' })).toBe(
      'kh.help.intro.anonymous.inbox.v1'
    );
  });

  it('persists a dismissal and reads it back', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    const key = introDismissalKey({ userId: 'user-a', featureKey: 'inbox' });

    expect(isIntroDismissed(key)).toBe(false);
    dismissIntro(key);
    expect(isIntroDismissed(key)).toBe(true);
    expect(storage.getItem(key)).toBe('1');
  });

  it('stays dismissed for the session when storage reads throw', () => {
    vi.stubGlobal(
      'localStorage',
      createStorage({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      })
    );
    const key = introDismissalKey({ userId: 'user-a', featureKey: 'inbox' });

    expect(isIntroDismissed(key)).toBe(false);
    dismissIntro(key);
    expect(isIntroDismissed(key)).toBe(true);
  });

  it('stays dismissed for the session when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    const key = introDismissalKey({ featureKey: 'pricing.smart' });

    expect(isIntroDismissed(key)).toBe(false);
    dismissIntro(key);
    expect(isIntroDismissed(key)).toBe(true);
  });

  it('reset clears both memory and storage', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    const key = introDismissalKey({ userId: 'user-a', featureKey: 'inbox' });

    dismissIntro(key);
    resetIntroDismissal(key);

    expect(isIntroDismissed(key)).toBe(false);
    expect(storage.getItem(key)).toBeNull();
  });
});
