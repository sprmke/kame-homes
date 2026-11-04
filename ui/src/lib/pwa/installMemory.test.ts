import { describe, expect, it } from 'vitest';

import {
  clearInstallMemory,
  hasHostInstall,
  markDontAskAgain,
  markFirstLaunchSeen,
  markHostInstall,
  readInstallMemory,
  recordInstallDismissal,
  recordSession,
  recordValueMoment,
  writeInstallMemory,
  type InstallMemory,
} from '@/lib/pwa/installMemory';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    raw: map,
  };
}

const GAP = 31 * 60 * 1000;

describe('install memory', () => {
  it('starts empty when nothing is stored', () => {
    expect(readInstallMemory(memoryStorage())).toEqual<InstallMemory>({
      sessions: 0,
      firstSeenAt: null,
      lastSessionAt: null,
      valueMoments: [],
      dismissCount: 0,
      lastDismissAt: null,
      dontAskAgain: false,
      hostInstall: false,
      firstLaunchSeen: false,
    });
  });

  it('counts a new session only after the inactivity gap', () => {
    const storage = memoryStorage();
    const first = recordSession(1_000, storage);
    expect(first.sessions).toBe(1);
    expect(first.firstSeenAt).toBe(1_000);

    const sameSession = recordSession(2_000, storage);
    expect(sameSession.sessions).toBe(1);

    const newSession = recordSession(2_000 + GAP, storage);
    expect(newSession.sessions).toBe(2);
    expect(newSession.firstSeenAt).toBe(1_000);
  });

  it('records each value moment once', () => {
    const storage = memoryStorage();
    recordValueMoment('booking-reviewed', 1, storage);
    recordValueMoment('booking-reviewed', 2, storage);
    recordValueMoment('inbox-reply-sent', 3, storage);
    expect(readInstallMemory(storage).valueMoments).toEqual(['booking-reviewed', 'inbox-reply-sent']);
  });

  it('increments the dismissal count and remembers the time', () => {
    const storage = memoryStorage();
    recordInstallDismissal(500, storage);
    recordInstallDismissal(900, storage);
    const memory = readInstallMemory(storage);
    expect(memory.dismissCount).toBe(2);
    expect(memory.lastDismissAt).toBe(900);
  });

  it('marks "don\'t ask again" without losing other counters', () => {
    const storage = memoryStorage();
    recordSession(1, storage);
    markDontAskAgain(storage);
    expect(readInstallMemory(storage)).toMatchObject({ dontAskAgain: true, sessions: 1 });
  });

  it('survives a device that has hosted', () => {
    const storage = memoryStorage();
    expect(hasHostInstall(storage)).toBe(false);
    markHostInstall(storage);
    expect(hasHostInstall(storage)).toBe(true);
  });

  it('records the first standalone launch once', () => {
    const storage = memoryStorage();
    markFirstLaunchSeen(storage);
    expect(readInstallMemory(storage).firstLaunchSeen).toBe(true);
  });

  it('degrades gracefully on corrupt JSON', () => {
    const storage = memoryStorage();
    storage.setItem('gfm:install:memory', '{not json');
    expect(readInstallMemory(storage).sessions).toBe(0);
  });

  it('tolerates a missing storage (private mode)', () => {
    expect(() => recordSession(1, null)).not.toThrow();
    expect(readInstallMemory(null).sessions).toBe(0);
  });

  it('clears every flag', () => {
    const storage = memoryStorage();
    markHostInstall(storage);
    markFirstLaunchSeen(storage);
    recordInstallDismissal(1, storage);
    clearInstallMemory(storage);
    expect(readInstallMemory(storage)).toMatchObject({
      hostInstall: false,
      firstLaunchSeen: false,
      dismissCount: 0,
    });
  });

  it('never persists unknown fields from a hand-edited payload', () => {
    const storage = memoryStorage();
    writeInstallMemory({ ...readInstallMemory(storage), sessions: 3 }, storage);
    storage.setItem('gfm:install:memory', JSON.stringify({ sessions: 3, evil: true }));
    expect(readInstallMemory(storage)).not.toHaveProperty('evil');
  });
});
