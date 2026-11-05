import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  consumeScrollPosition,
  isReloadNavigation,
  saveScrollPosition,
} from '@/lib/pwa/scrollMemory';

/**
 * jsdom has sessionStorage but no layout, so the DOM halves are stubbed. The
 * contract under test is the read-once behaviour and the tolerant parse.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

describe('scrollMemory', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('window', { scrollY: 240, scrollTo: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and consumes once per path', () => {
    const doc = {
      querySelector: (selector: string) =>
        selector === '[data-admin-content-scroll]' ? { scrollTop: 512 } : null,
    } as unknown as Document;

    saveScrollPosition('/org/acme/bookings', doc);
    expect(consumeScrollPosition('/org/acme/bookings')).toEqual({
      window: 240,
      containers: { '[data-admin-content-scroll]': 512 },
    });
    // Second consume is empty: a normal navigation must start at the top.
    expect(consumeScrollPosition('/org/acme/bookings')).toBeNull();
  });

  it('keeps paths independent', () => {
    const doc = { querySelector: () => null } as unknown as Document;
    saveScrollPosition('/bookings', doc);
    expect(consumeScrollPosition('/inbox')).toBeNull();
    expect(consumeScrollPosition('/bookings')).not.toBeNull();
  });

  it('ignores malformed entries', () => {
    sessionStorage.setItem('gfm:scroll:/x', 'not json');
    expect(consumeScrollPosition('/x')).toBeNull();
  });

  it('only a reload restores scroll', () => {
    vi.stubGlobal('performance', {
      getEntriesByType: () => [{ type: 'navigate' }],
    });
    expect(isReloadNavigation()).toBe(false);
    vi.stubGlobal('performance', {
      getEntriesByType: () => [{ type: 'reload' }],
    });
    expect(isReloadNavigation()).toBe(true);
    vi.stubGlobal('performance', { getEntriesByType: () => [] });
    expect(isReloadNavigation()).toBe(false);
  });
});
