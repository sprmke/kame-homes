import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  markHostAnnouncementRead,
  markHostAnnouncementsRead,
  readHostAnnouncementReadKeys,
} from '@/features/dashboard/announcements/lib/hostAnnouncementReadState';

const ORG_ID = 'org-test-read-all';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage);
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('markHostAnnouncementsRead', () => {
  it('marks multiple unread keys in one write', () => {
    markHostAnnouncementsRead(ORG_ID, ['a', 'b', 'c']);
    const keys = readHostAnnouncementReadKeys(ORG_ID);
    expect(keys.has('a')).toBe(true);
    expect(keys.has('b')).toBe(true);
    expect(keys.has('c')).toBe(true);
  });

  it('is a no-op when all keys are already read', () => {
    markHostAnnouncementRead(ORG_ID, 'a');
    markHostAnnouncementsRead(ORG_ID, ['a']);
    expect([...readHostAnnouncementReadKeys(ORG_ID)]).toEqual(['a']);
  });

  it('ignores empty keys', () => {
    markHostAnnouncementsRead(ORG_ID, ['', 'x']);
    expect([...readHostAnnouncementReadKeys(ORG_ID)]).toEqual(['x']);
  });
});
