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
 * Checks both directions now that A1–A5 are instrumented: anything the edge emits must be
 * declared on both sides, the edge catalog must be a subset of the browser one, and every
 * declared name must have an emitter. The last direction used to be excluded because a
 * planned event would fail the suite; with the matrix wired there is no planned backlog
 * left, so a declared-but-dead name is exactly the drift worth failing on.
 */

const ROOT = resolve(import.meta.dirname, '../../../..');
const FUNCTIONS_ROOT = join(ROOT, 'supabase/functions');
const UI_ROOT = join(ROOT, 'ui/src');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'tests') continue;
      walk(full, files);
    } else if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.endsWith('_test.ts')) {
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

function emittedBrowserEvents(): string[] {
  const found = new Set<string>();
  for (const file of walk(UI_ROOT)) {
    if (
      file.includes('/node_modules/') ||
      file.endsWith('.test.ts') ||
      file.endsWith('.test.tsx') ||
      file.includes('/__tests__/')
    ) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/captureAppEvent\(\s*['"]([a-z0-9_]+)['"]/g)) {
      found.add(match[1]!);
    }
  }
  return [...found].sort();
}

/**
 * Emitted through a variable rather than a literal: voice picks the name with a ternary, and
 * the PWA sink maps a kebab-case telemetry name to its catalog name. Static scanning cannot
 * see either, so they are named here instead of loosening the regex for every file.
 */
const DYNAMIC_EMITTERS = new Set([
  'voice_session_ended',
  'voice_session_failed',
  'pwa_install_prompt_shown',
  'pwa_install_outcome',
  'pwa_installed',
  'pwa_push_changed',
  'pwa_offline_queued',
  'pwa_sync_failed',
  'pwa_update_applied',
  'pwa_kill_switch',
  'pwa_launch_fallback',
]);

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

  it('every declared event is emitted somewhere', () => {
    const emitted = new Set([...emittedBrowserEvents(), ...emittedEdgeEvents()]);
    const dead = APP_ANALYTICS_EVENTS.filter(
      (event) => !emitted.has(event) && !DYNAMIC_EMITTERS.has(event)
    );
    expect(dead).toEqual([]);
  });
});
