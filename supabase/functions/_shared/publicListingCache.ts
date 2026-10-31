/**
 * In-isolate response cache for public listing endpoints.
 *
 * Keys fold in the catalog version of every family the response reads
 * (`public_listing_catalog_version`, bumped by the index triggers on any listing,
 * price, review, or development change). A write therefore invalidates every cached
 * response for that family as soon as this isolate re-reads the version (≤
 * VERSION_TTL_MS), without per-key purges.
 *
 * Scope: public, non-personalized payloads only (never pass an authenticated or
 * per-viewer read through here). Availability-filtered requests bypass the cache,
 * because bookings change availability without touching the catalog.
 *
 * Concurrent identical misses in one isolate share a single in-flight compute.
 */

import { createServiceClient } from './orgAuth.ts';
import type { ListingFamily } from './publicListingSearch.ts';

const VERSION_TTL_MS = 5_000;
const ENTRY_TTL_MS = 60_000;
const MAX_ENTRIES = 300;

type Versions = Record<ListingFamily, number>;

let versionSnapshot: { at: number; value: Versions } | null = null;
let versionInFlight: Promise<Versions> | null = null;

let loadVersions: () => Promise<Versions> = fetchVersions;

const entries = new Map<string, { expiresAt: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

async function fetchVersions(): Promise<Versions> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('public_listing_catalog_versions');
  if (error) throw new Error(`catalog versions failed: ${error.message}`);
  const body = (data ?? {}) as Partial<Record<ListingFamily, number>>;
  return {
    property: Number(body.property ?? 0),
    development: Number(body.development ?? 0),
    parking: Number(body.parking ?? 0),
  };
}

function currentVersions(now: number): Promise<Versions> {
  if (versionSnapshot && now - versionSnapshot.at < VERSION_TTL_MS) {
    return Promise.resolve(versionSnapshot.value);
  }
  if (!versionInFlight) {
    versionInFlight = loadVersions()
      .then((value) => {
        versionSnapshot = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        versionInFlight = null;
      });
  }
  return versionInFlight;
}

function remember(key: string, value: unknown, now: number): void {
  entries.delete(key);
  entries.set(key, { expiresAt: now + ENTRY_TTL_MS, value });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export type ListingCacheOptions = {
  /** Families whose catalog version must match for a hit. */
  families: ListingFamily[];
  /** Skip the cache (e.g. date-filtered availability requests). */
  bypass?: boolean;
};

/**
 * Get-or-compute with version-scoped keys. A failed version read falls back to
 * computing directly — a broken cache never breaks the endpoint.
 */
export async function withListingCache<T>(
  key: string,
  options: ListingCacheOptions,
  compute: () => Promise<T>
): Promise<T> {
  if (options.bypass) return compute();

  const now = Date.now();
  let versions: Versions;
  try {
    versions = await currentVersions(now);
  } catch (error) {
    console.warn('[publicListingCache] version read failed:', (error as Error).message);
    return compute();
  }

  const versionTag = options.families.map((family) => `${family}:${versions[family]}`).join('|');
  const fullKey = `${versionTag}#${key}`;

  const hit = entries.get(fullKey);
  if (hit && hit.expiresAt > now) {
    entries.delete(fullKey);
    entries.set(fullKey, hit);
    return hit.value as T;
  }

  const pending = inFlight.get(fullKey);
  if (pending) return pending as Promise<T>;

  const promise = compute()
    .then((value) => {
      remember(fullKey, value, Date.now());
      return value;
    })
    .finally(() => {
      inFlight.delete(fullKey);
    });
  inFlight.set(fullKey, promise);
  return promise;
}

/** Stable cache key from a params object (sorted keys, arrays kept in order). */
export function listingCacheKey(namespace: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]]);
  return `${namespace}:${JSON.stringify(sorted)}`;
}

/** Test hook: reset module state and optionally stub the version loader. */
export function __resetListingCacheForTests(versionLoader?: () => Promise<Versions>): void {
  loadVersions = versionLoader ?? fetchVersions;
  entries.clear();
  inFlight.clear();
  versionSnapshot = null;
  versionInFlight = null;
}
