import { describe, expect, it } from 'vitest';

import {
  MAX_PERSISTED_PAGES,
  offlinePersistRoots,
  queryKeyRoot,
  shouldPersistQuery,
} from '@/lib/pwa/offlineQueryAllowlist';

type FakeQuery = Parameters<typeof shouldPersistQuery>[0];

function query(queryKey: unknown, status = 'success', data: unknown = { ok: true }): FakeQuery {
  return { queryKey, state: { status, data } } as unknown as FakeQuery;
}

/** Explicit `undefined` data (the default parameter would mask it). */
function emptyQuery(queryKey: unknown): FakeQuery {
  return { queryKey, state: { status: 'success', data: undefined } } as unknown as FakeQuery;
}

describe('queryKeyRoot', () => {
  it('reads the first string of a conventional key', () => {
    expect(queryKeyRoot(['bookings', 'org', 1])).toBe('bookings');
  });

  it('returns null for unusual keys', () => {
    expect(queryKeyRoot([])).toBeNull();
    expect(queryKeyRoot(['x'])).toBe('x');
    expect(queryKeyRoot([123])).toBeNull();
    expect(queryKeyRoot('bookings')).toBeNull();
    expect(queryKeyRoot(undefined)).toBeNull();
  });
});

describe('shouldPersistQuery', () => {
  it('persists allowlisted, successful queries with data', () => {
    expect(shouldPersistQuery(query(['bookings', 'acme']))).toBe(true);
    expect(shouldPersistQuery(query(['notifications']))).toBe(true);
    expect(shouldPersistQuery(query(['inbox-threads', 'acme']))).toBe(true);
  });

  it('never persists unknown roots', () => {
    expect(shouldPersistQuery(query(['super-admin']))).toBe(false);
    expect(shouldPersistQuery(query(['team-invite-preview']))).toBe(false);
    expect(shouldPersistQuery(query(['marketing-templates']))).toBe(false);
  });

  it('never persists failed or empty queries', () => {
    expect(shouldPersistQuery(query(['bookings'], 'error'))).toBe(false);
    expect(shouldPersistQuery(query(['bookings'], 'pending'))).toBe(false);
    expect(shouldPersistQuery(emptyQuery(['bookings']))).toBe(false);
  });

  it('caps infinite-query page sets', () => {
    const shallow = { pages: [{}, {}] };
    const deep = { pages: [{}, {}, {}, {}] };
    expect(MAX_PERSISTED_PAGES).toBe(2);
    expect(shouldPersistQuery(query(['notifications'], 'success', shallow))).toBe(true);
    expect(shouldPersistQuery(query(['notifications'], 'success', deep))).toBe(false);
  });

  it('keeps the allowlist free of write-only and super-admin surfaces', () => {
    const roots = offlinePersistRoots();
    for (const forbidden of [
      'super-admin',
      'marketing-templates',
      'team-invite-preview',
      'org-plan',
      'meta-publish-connections',
    ]) {
      expect(roots, forbidden).not.toContain(forbidden);
    }
  });

  it('covers every operational read view the offline matrix promises', () => {
    const roots = offlineQueryAllowlist();
    for (const required of [
      'bookings',
      'booking',
      'notifications',
      'inbox-threads',
      'inbox-messages',
      'maintenance-items',
      'finance-summary',
      'activity-log',
      'analytics-summary',
      'host-announcements',
      'guest-trips',
    ]) {
      expect(roots, required).toContain(required);
    }
  });
});

function offlineQueryAllowlist(): string[] {
  return offlinePersistRoots();
}
