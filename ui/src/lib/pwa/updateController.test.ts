import { describe, expect, it } from 'vitest';

import {
  MAX_AUTO_RELOADS,
  UPDATE_SNOOZE_MS,
  bumpAutoReloadCount,
  canApplyNow,
  canAutoReload,
  isSnoozed,
  isUpdateApplyBlocked,
  nextSnoozeUntil,
  parseUpdateBroadcast,
  readAutoReloadCount,
  updateBlockers,
} from '@/lib/pwa/updateController';

const CLEAN = {
  dirtyGuards: 0,
  overlayOpen: false,
  outboxDraining: false,
  taskInFlight: false,
};

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('canApplyNow', () => {
  it('allows a reload when nothing would be lost', () => {
    expect(canApplyNow(CLEAN)).toBe(true);
    expect(updateBlockers(CLEAN)).toEqual([]);
  });

  it.each([
    ['dirtyGuards', 1, 'dirty-form'],
    ['overlayOpen', true, 'overlay-open'],
    ['outboxDraining', true, 'outbox-draining'],
    ['taskInFlight', true, 'task-in-flight'],
  ])('blocks on %s', (field, value, reason) => {
    const snapshot = { ...CLEAN, [field]: value };
    expect(canApplyNow(snapshot)).toBe(false);
    expect(updateBlockers(snapshot)).toEqual([reason]);
  });

  it('reports every blocker at once', () => {
    expect(
      updateBlockers({
        dirtyGuards: 2,
        overlayOpen: true,
        outboxDraining: true,
        taskInFlight: true,
      })
    ).toEqual(['dirty-form', 'overlay-open', 'outbox-draining', 'task-in-flight']);
  });
});

describe('snooze', () => {
  it('snoozes for four hours', () => {
    const now = 1_000;
    const until = nextSnoozeUntil(now);
    expect(until - now).toBe(UPDATE_SNOOZE_MS);
    expect(isSnoozed(until, now + 1000)).toBe(true);
    expect(isSnoozed(until, until)).toBe(false);
    expect(isSnoozed(null, now)).toBe(false);
  });
});

describe('auto-reload loop guard', () => {
  it('allows two automatic reloads, then stops', () => {
    const storage = memoryStorage();
    expect(canAutoReload(storage)).toBe(true);
    bumpAutoReloadCount(storage);
    expect(readAutoReloadCount(storage)).toBe(1);
    bumpAutoReloadCount(storage);
    expect(canAutoReload(storage)).toBe(false);
    expect(MAX_AUTO_RELOADS).toBe(2);
  });

  it('treats a missing storage as "no reloads yet"', () => {
    expect(readAutoReloadCount(null)).toBe(0);
    expect(canAutoReload(null)).toBe(true);
  });

  it('ignores a corrupt counter', () => {
    const storage = memoryStorage();
    storage.setItem('gfm:pwa:auto-reloads', 'not-a-number');
    expect(readAutoReloadCount(storage)).toBe(0);
  });

  it('blocks automatic applies after the limit, but never blocks a user Reload', () => {
    const storage = memoryStorage();
    bumpAutoReloadCount(storage);
    bumpAutoReloadCount(storage);
    expect(canAutoReload(storage)).toBe(false);
    // This is the bug we fixed: the Update ready prompt is what we show after the
    // loop guard trips — tapping Reload must still apply the waiting worker.
    expect(isUpdateApplyBlocked('auto', storage)).toBe(true);
    expect(isUpdateApplyBlocked('user', storage)).toBe(false);
  });
});

describe('parseUpdateBroadcast', () => {
  it('accepts the coordination messages', () => {
    expect(parseUpdateBroadcast({ type: 'update-ready', nonce: 'a' })).toEqual({
      type: 'update-ready',
      nonce: 'a',
    });
    expect(parseUpdateBroadcast({ type: 'surface-claim', surface: 'update' })).toEqual({
      type: 'surface-claim',
      surface: 'update',
    });
  });

  it('rejects unknown types and missing payloads', () => {
    expect(parseUpdateBroadcast({ type: 'nope' })).toBeNull();
    expect(parseUpdateBroadcast({ type: 'update-ready' })).toBeNull();
    expect(parseUpdateBroadcast({ type: 'surface-claim' })).toBeNull();
    expect(parseUpdateBroadcast(null)).toBeNull();
    expect(parseUpdateBroadcast('update-ready')).toBeNull();
  });
});
