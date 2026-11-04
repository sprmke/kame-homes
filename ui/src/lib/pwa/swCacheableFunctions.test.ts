import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SW_CACHEABLE_FUNCTIONS } from '@/pwa/shared';

/**
 * Task 3.3: every name in `SW_CACHEABLE_FUNCTIONS` must be a genuinely public read
 * in the server's own cache policy (`_shared/httpResponse.ts`). Until now that was a
 * comment-level promise; a name that is actually `private, no-store` would put
 * tenant or guest PII in Cache Storage, which is a persistent leak on a shared or
 * kiosk device rather than mere staleness.
 *
 * The server classifies per call site (there is no central registry), so this test
 * checks two things that are cheap and unambiguous:
 *  1. the function's own source declares a `public*` cache class, and
 *  2. its name follows the public-read naming convention, so a new private read
 *     cannot be added here by accident without an explicit review.
 */
const FUNCTIONS_DIR = '../supabase/functions';

const PUBLIC_CLASSES = ['publicStatic', 'publicDynamic', 'publicAvailability'] as const;

/** Naming prefixes that are only used by genuinely public reads. */
const PUBLIC_NAME_PREFIXES = [
  'get-public-',
  'list-public-',
  'search-',
  'get-booked-dates',
  'get-residence-unit-types',
];

function sourceFiles(fnName: string): string[] {
  const dir = join(FUNCTIONS_DIR, fnName);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

describe('SW_CACHEABLE_FUNCTIONS', () => {
  it('is an explicit, non-empty set of names', () => {
    expect(SW_CACHEABLE_FUNCTIONS.size).toBeGreaterThan(0);
    for (const name of SW_CACHEABLE_FUNCTIONS) {
      expect(name).toMatch(/^[a-z][a-z0-9-]+$/);
    }
  });

  it('only lists functions that exist on disk', () => {
    for (const name of SW_CACHEABLE_FUNCTIONS) {
      expect(existsSync(join(FUNCTIONS_DIR, name)), `missing function: ${name}`).toBe(true);
    }
  });

  it('only lists functions whose own source declares a public cache class', () => {
    const unclassified: string[] = [];
    for (const name of SW_CACHEABLE_FUNCTIONS) {
      const files = sourceFiles(name);
      const declaresPublic = files.some((file) =>
        PUBLIC_CLASSES.some((cacheClass) => readFileSync(file, 'utf8').includes(cacheClass))
      );
      if (!declaresPublic) unclassified.push(name);
    }
    expect(unclassified).toEqual([]);
  });

  it('only lists functions that follow the public-read naming convention', () => {
    for (const name of SW_CACHEABLE_FUNCTIONS) {
      expect(
        PUBLIC_NAME_PREFIXES.some((prefix) => name.startsWith(prefix)),
        `unexpected name in SW_CACHEABLE_FUNCTIONS: ${name}`
      ).toBe(true);
    }
  });

  it('matches the reviewed snapshot (adding cacheable data is a security decision)', () => {
    expect([...SW_CACHEABLE_FUNCTIONS].sort()).toMatchSnapshot();
  });
});
