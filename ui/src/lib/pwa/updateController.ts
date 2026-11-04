/**
 * Update controller — the pure half of "updates apply on their own, safely".
 *
 * v1 stalled: installed apps are rarely closed, "Later" hid the prompt for the
 * whole session, and the only reload path was a user click (P1-3). This module
 * decides *when* a waiting service worker may take over; the hook
 * (`useRegisterSW`) wires browser events to it.
 */

export type UpdatePhase = 'idle' | 'available' | 'ready' | 'applying';

/** "Later" snoozes for four hours, or until the next cold start. */
export const UPDATE_SNOOZE_MS = 4 * 60 * 60 * 1000;

/** Auto-apply when the app has been backgrounded at least this long. */
export const BACKGROUND_APPLY_MS = 30 * 1000;

/** Throttle `registration.update()`: foreground + online + hourly stack up fast. */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 10 * 60 * 1000;

export type UpdateGuardSnapshot = {
  /** Number of mounted unsaved-changes guards reporting dirty. */
  dirtyGuards: number;
  /** A Sheet / Dialog / lightbox is open. */
  overlayOpen: boolean;
  /** The offline outbox is draining (a reload would abort the in-flight request). */
  outboxDraining: boolean;
  /** A background task the app must not interrupt (upload, AI stream). */
  taskInFlight: boolean;
};

/** Reasons a reload would lose work. Kept as strings for telemetry/debugging. */
export function updateBlockers(snapshot: UpdateGuardSnapshot): string[] {
  const blockers: string[] = [];
  if (snapshot.dirtyGuards > 0) blockers.push('dirty-form');
  if (snapshot.overlayOpen) blockers.push('overlay-open');
  if (snapshot.outboxDraining) blockers.push('outbox-draining');
  if (snapshot.taskInFlight) blockers.push('task-in-flight');
  return blockers;
}

export function canApplyNow(snapshot: UpdateGuardSnapshot): boolean {
  return updateBlockers(snapshot).length === 0;
}

export function isSnoozed(snoozedUntil: number | null, now: number): boolean {
  return snoozedUntil !== null && snoozedUntil > now;
}

export function nextSnoozeUntil(now: number): number {
  return now + UPDATE_SNOOZE_MS;
}

/** Cross-tab coordination channel (`BroadcastChannel('gfm-pwa')`). */
export const UPDATE_CHANNEL = 'gfm-pwa';

export type UpdateBroadcast =
  | { type: 'update-ready'; nonce: string }
  | { type: 'update-applying'; nonce: string }
  | { type: 'update-applied'; nonce: string }
  | { type: 'surface-claim'; surface: string }
  | { type: 'surface-release'; surface: string };

const BROADCAST_TYPES = new Set([
  'update-ready',
  'update-applying',
  'update-applied',
  'surface-claim',
  'surface-release',
]);

/** Defensive parse — a malformed/foreign post must never break the controller. */
export function parseUpdateBroadcast(raw: unknown): UpdateBroadcast | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { type?: unknown; nonce?: unknown; surface?: unknown };
  if (typeof value.type !== 'string' || !BROADCAST_TYPES.has(value.type)) return null;
  if (value.type === 'surface-claim' || value.type === 'surface-release') {
    return typeof value.surface === 'string'
      ? { type: value.type, surface: value.surface }
      : null;
  }
  if (typeof value.nonce !== 'string') return null;
  return { type: value.type as 'update-ready' | 'update-applying' | 'update-applied', nonce: value.nonce };
}

/**
 * Auto-reload loop guard. A broken deploy would otherwise reload the app forever;
 * after two automatic reloads in one tab session we stop auto-applying and only
 * offer the manual prompt.
 */
const RELOAD_GUARD_KEY = 'gfm:pwa:auto-reloads';
export const MAX_AUTO_RELOADS = 2;

export function readAutoReloadCount(storage: Pick<Storage, 'getItem'> | null): number {
  if (!storage) return 0;
  try {
    const value = Number(storage.getItem(RELOAD_GUARD_KEY) ?? '0');
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function bumpAutoReloadCount(storage: Pick<Storage, 'getItem' | 'setItem'> | null): number {
  const next = readAutoReloadCount(storage) + 1;
  if (storage) {
    try {
      storage.setItem(RELOAD_GUARD_KEY, String(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function canAutoReload(storage: Pick<Storage, 'getItem'> | null): boolean {
  return readAutoReloadCount(storage) < MAX_AUTO_RELOADS;
}
