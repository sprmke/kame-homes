import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_ANALYTICS_EVENTS } from '@/lib/posthog/catalog';

import { POSTHOG_EVENTS as EDGE_EVENTS } from '../../../../supabase/functions/_shared/posthogCatalog.ts';

/**
 * Catalog drift is silent: `capturePostHogEvent('review_pair_published')` type-checks against
 * a stale union, ships, and the event never appears in a PostHog insight because nobody
 * declared it. Five review events were in exactly that state (plan F-08).
 *
 * This checks the direction that breaks things now: anything the edge emits must exist in
 * both catalogs, and the edge catalog must be a subset of the browser one. The reverse
 * direction ("declared but never emitted") is deliberately not enforced yet — roughly 28
 * catalog entries are waiting for A1–A5 to wire them, and a failing test for planned work
 * just gets an allowlist nobody maintains.
 */

const ROOT = resolve(import.meta.dirname, '../../../..');
const FUNCTIONS_ROOT = join(ROOT, 'supabase/functions');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'tests') continue;
      walk(full, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('_test.ts')) {
      files.push(full);
    }
  }
  return files;
}

function emittedEdgeEvents(): string[] {
  const found = new Set<string>();
  for (const file of walk(FUNCTIONS_ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/capturePostHogEvent\(\s*['"]([a-z0-9_]+)['"]/g)) {
      found.add(match[1]!);
    }
  }
  return [...found].sort();
}

describe('posthog catalog parity', () => {
  it('the edge catalog is a subset of the browser catalog', () => {
    const browser = new Set<string>(APP_ANALYTICS_EVENTS);
    const missing = [...EDGE_EVENTS].filter((event) => !browser.has(event));
    expect(missing).toEqual([]);
  });

  it('every event the edge actually emits is declared in the edge catalog', () => {
    const declared = new Set<string>(EDGE_EVENTS);
    const undeclared = emittedEdgeEvents().filter((event) => !declared.has(event));
    expect(undeclared).toEqual([]);
  });

  it('the browser catalog has no duplicate entries', () => {
    expect(new Set(APP_ANALYTICS_EVENTS).size).toBe(APP_ANALYTICS_EVENTS.length);
  });
});
