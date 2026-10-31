import { describe, expect, it } from 'vitest';

import {
  countByStatus,
  formatAgo,
  formatBytes,
  groupChecks,
  matchesFilter,
  sortChecks,
  worstStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

describe('worstStatus', () => {
  it('ranks error > warn > unknown > ok > off', () => {
    expect(worstStatus(['ok', 'warn', 'off'])).toBe('warn');
    expect(worstStatus(['unknown', 'ok'])).toBe('unknown');
    expect(worstStatus(['warn', 'error'])).toBe('error');
    expect(worstStatus(['off'])).toBe('off');
    expect(worstStatus([])).toBe('off');
  });
});

describe('grouping and sorting', () => {
  const checks = [
    { group: 'B', label: 'b1', status: 'ok' as const },
    { group: 'A', label: 'a2', status: 'ok' as const },
    { group: 'A', label: 'a1', status: 'error' as const },
  ];

  it('sorts worst first, then by label', () => {
    expect(sortChecks(checks).map((c) => c.label)).toEqual(['a1', 'a2', 'b1']);
  });

  it('groups with a rolled-up status, worst group first', () => {
    const groups = groupChecks(checks);
    expect(groups.map((g) => [g.group, g.status])).toEqual([
      ['A', 'error'],
      ['B', 'ok'],
    ]);
  });

  it('counts by status', () => {
    expect(countByStatus(checks)).toEqual({ ok: 2, warn: 0, error: 1, off: 0, unknown: 0 });
  });
});

describe('formatAgo and formatBytes', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  it('formats relative time', () => {
    expect(formatAgo('2026-10-19T11:59:50Z', now)).toBe('just now');
    expect(formatAgo('2026-10-19T11:55:00Z', now)).toBe('5m ago');
    expect(formatAgo('2026-10-19T09:00:00Z', now)).toBe('3h ago');
    expect(formatAgo('2026-10-16T12:00:00Z', now)).toBe('3d ago');
  });
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
  });
});

describe('matchesFilter', () => {
  it('issues means warn or error', () => {
    expect(matchesFilter('warn', 'issues')).toBe(true);
    expect(matchesFilter('error', 'issues')).toBe(true);
    expect(matchesFilter('unknown', 'issues')).toBe(false);
    expect(matchesFilter('off', 'all')).toBe(true);
    expect(matchesFilter('ok', 'ok')).toBe(true);
  });
});
