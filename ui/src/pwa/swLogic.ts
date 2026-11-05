/**
 * Pure logic extracted from the service worker so it can be unit-tested in Node
 * (`vitest`, no worker globals). `sw.ts` only wires events to these functions.
 *
 * Nothing here touches `self`, `caches`, `fetch` or `navigator`.
 */

/** Only allow same-origin, app-relative click targets (defence in depth). */
export function safeAppPath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  // Reject backslash tricks and control characters that some routers normalise
  // differently.
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\\' || code < 0x20) return fallback;
  }
  return raw;
}

const FUNCTION_PATH_RE = /\/functions\/v1\/([^/?]+)/;

/** Edge function name of a request path, when it is in `SW_CACHEABLE_FUNCTIONS`. */
export function cacheableFunctionName(
  pathname: string,
  allowlist: ReadonlySet<string>
): string | null {
  const match = FUNCTION_PATH_RE.exec(pathname);
  const name = match?.[1];
  return name && allowlist.has(name) ? name : null;
}

export type KillSwitchDescriptor = {
  disabled?: boolean;
  minBuild?: number;
  forceUpdateBelow?: number;
};

/**
 * `disabled: true` or `minBuild > buildId` = the app must stop being served from
 * cache entirely (v1 kill-switch: wipe + unregister).
 */
export function isKillSwitchTripped(
  descriptor: KillSwitchDescriptor | null | undefined,
  buildId: number
): boolean {
  if (!descriptor) return false;
  return descriptor.disabled === true || (descriptor.minBuild ?? 0) > buildId;
}

/**
 * A softer signal than the kill-switch: this build still works, but the user has
 * to update before continuing (`forceUpdateBelow`). Unlike the kill-switch it
 * keeps caches so a reinstall is not required.
 */
export function isForceUpdateRequired(
  descriptor: KillSwitchDescriptor | null | undefined,
  buildId: number
): boolean {
  if (!descriptor) return false;
  return (descriptor.forceUpdateBelow ?? 0) > buildId;
}

/** One precache entry as written by `scripts/pwa/generate-precache-tiers.mjs`. */
export type PrecacheEntry = { url: string; revision: string | null };

export type PrecacheTiers = {
  /** Epoch-seconds build that wrote this list; `0` when the file predates the field. */
  buildId: number;
  shell: PrecacheEntry[];
  host: PrecacheEntry[];
  onDemand: PrecacheEntry[];
};

function isEntry(value: unknown): value is PrecacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { url?: unknown; revision?: unknown };
  return (
    typeof entry.url === 'string' &&
    entry.url.startsWith('/') &&
    (entry.revision === null || typeof entry.revision === 'string')
  );
}

function normalizeList(value: unknown): PrecacheEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEntry).map((entry) => ({ url: entry.url, revision: entry.revision }));
}

/**
 * Validate the tier manifest fetched at install. Returns `null` when the payload
 * is unusable so the SW can fall back to the injected manifest instead of
 * installing an empty precache and losing the offline shell.
 */
export function parsePrecacheTiers(raw: unknown): PrecacheTiers | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { buildId?: unknown; shell?: unknown; host?: unknown; onDemand?: unknown };
  const shell = normalizeList(value.shell);
  if (shell.length === 0) return null;
  // The navigation fallback must always be precached, otherwise every offline
  // navigation falls through to the offline page even though the shell exists.
  if (!shell.some((entry) => entry.url === '/index.html')) return null;
  const buildId =
    typeof value.buildId === 'number' && Number.isFinite(value.buildId) ? value.buildId : 0;
  return {
    buildId,
    shell,
    host: normalizeList(value.host),
    onDemand: normalizeList(value.onDemand),
  };
}

/**
 * A tier manifest is only usable by the worker from the same build — its hashed
 * asset names change on every deploy. When either side cannot be identified
 * (dev worker, manifest written before `buildId` existed) the check is skipped
 * rather than discarding a possibly-good list.
 */
export function isTiersManifestForBuild(
  tiers: PrecacheTiers | null | undefined,
  buildId: number
): boolean {
  if (!tiers) return false;
  if (!buildId || !tiers.buildId) return true;
  return tiers.buildId === buildId;
}

export type WarmDecision = { warm: true } | { warm: false; reason: string };

export type WarmInput = {
  online: boolean;
  /** `navigator.connection.saveData`. */
  saveData: boolean;
  /** `navigator.connection.effectiveType`. */
  effectiveType?: string;
  /** Running as an installed app. */
  standalone: boolean;
  /** Already warmed this session / build. */
  alreadyWarmed: boolean;
};

/**
 * Host-tier warming downloads dashboard route chunks in the background. It must
 * never compete with a guest's first page load on metered data (P0-2 / 1.8).
 */
export function shouldWarmHostTier(input: WarmInput): WarmDecision {
  if (!input.online) return { warm: false, reason: 'offline' };
  if (input.alreadyWarmed) return { warm: false, reason: 'already-warmed' };
  if (input.saveData) return { warm: false, reason: 'save-data' };
  const type = input.effectiveType ?? '';
  if (type === 'slow-2g' || type === '2g') return { warm: false, reason: `network-${type}` };
  return { warm: true };
}

/**
 * Old-domain retirement: an installed app on `kamehomes.space` must move to the
 * canonical host, preserving the path and query.
 */
export function retirementTarget(
  requestUrl: string,
  legacyHosts: readonly string[],
  canonicalOrigin: string
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!legacyHosts.includes(parsed.hostname)) return null;
  const canonical = new URL(canonicalOrigin);
  return `${canonical.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * A push payload is attacker-controlled only in the sense that the sender holds
 * the VAPID key; still, badge/text/link values must be coerced before they reach
 * `showNotification`.
 */
export function normalizeBadgeCount(raw: unknown): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const count = Math.trunc(value);
  if (count <= 0) return null;
  return Math.min(count, 9999);
}

/** Notification bodies are truncated so the encrypted payload stays under 4 KB. */
export function truncatePushBody(body: unknown, max = 300): string {
  if (typeof body !== 'string') return '';
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}\u2026`;
}
