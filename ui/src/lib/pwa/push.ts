import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { captureAppEvent } from '@/lib/posthog/capture';
import { getPwaCapabilities } from '@/lib/pwa/capabilities';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { whenSwReady } from '@/lib/pwa/swRegistration';

import { SW_MESSAGE } from '@/pwa/shared';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

/**
 * Reading state must stay fast: the Notifications page renders a switch from it,
 * and a missing/slow service worker must not freeze the row for the 10s default.
 * When the worker does register, `usePushNotifications` re-reads.
 */
const PUSH_STATE_SW_TIMEOUT_MS = 2000;
/** Subscribing needs the worker, so give it longer before reporting failure. */
const PUSH_ENABLE_SW_TIMEOUT_MS = 2500;

/**
 * Why push cannot be turned on here. `supported` is about this app instance
 * right now, not just the browser: a missing service worker means the toggle
 * must stay off instead of failing after a click.
 */
export type PushUnsupportedReason = 'unsupported' | 'not-configured' | 'not-ready';

export type PushState = {
  supported: boolean;
  /** Set when `supported` is false, so the UI can explain the real cause. */
  reason?: PushUnsupportedReason | null;
  /** Push only works on iOS/iPadOS when the app is installed to the home screen. */
  needsInstallFirst: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
};

/**
 * Pure decision so the "can this device subscribe right now?" rule is testable
 * without a browser. A registered but inactive worker cannot subscribe yet.
 */
export function resolvePushSupport(input: {
  browserPush: boolean;
  browserServiceWorker: boolean;
  hasVapidKey: boolean;
  workerActive: boolean;
}): { supported: boolean; reason: PushUnsupportedReason | null } {
  if (!input.browserPush || !input.browserServiceWorker) {
    return { supported: false, reason: 'unsupported' };
  }
  if (!input.hasVapidKey) return { supported: false, reason: 'not-configured' };
  if (!input.workerActive) return { supported: false, reason: 'not-ready' };
  return { supported: true, reason: null };
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function platformTag(): string {
  const caps = getPwaCapabilities();
  if (caps.isIos) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

export async function getPushState(): Promise<PushState> {
  const caps = getPwaCapabilities();
  const base = {
    needsInstallFirst: caps.isIos && !caps.standalone,
    permission: (caps.notifications ? Notification.permission : 'unsupported') as
      NotificationPermission | 'unsupported',
  };

  if (!caps.push || !caps.serviceWorker) {
    return { ...base, supported: false, reason: 'unsupported', subscribed: false };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ...base, supported: false, reason: 'not-configured', subscribed: false };
  }

  const reg = await whenSwReady(PUSH_STATE_SW_TIMEOUT_MS);
  /*
   * `reg.active` is what `pushManager.subscribe()` needs. A registration that is
   * still installing (or absent) must not present an enabled switch: that was the
   * path that let a click reach `enablePush` and fail with a toast.
   */
  const { supported, reason } = resolvePushSupport({
    browserPush: caps.push,
    browserServiceWorker: caps.serviceWorker,
    hasVapidKey: Boolean(VAPID_PUBLIC_KEY),
    workerActive: Boolean(reg?.active),
  });
  const existing = await reg?.pushManager.getSubscription().catch(() => null);

  return {
    ...base,
    supported,
    reason,
    subscribed: Boolean(existing),
  };
}

/**
 * Ask for permission (must be inside a user gesture on iOS), subscribe with the
 * VAPID key, and register the subscription server-side. Idempotent.
 */
export async function enablePush(): Promise<PushState> {
  const caps = getPwaCapabilities();
  if (!caps.push || !VAPID_PUBLIC_KEY) return getPushState();

  const prompting = Notification.permission !== 'granted';
  const permission = prompting ? await Notification.requestPermission() : 'granted';
  if (prompting) {
    // A real browser prompt, inside the user gesture. `outcome` is what the browser said.
    captureAppEvent('push_opt_in_prompted', { outcome: permission });
  }
  if (permission !== 'granted') return getPushState();

  const reg = await whenSwReady(PUSH_ENABLE_SW_TIMEOUT_MS);
  /*
   * The browser says it supports push but no worker is controlling the page, so
   * subscribing is impossible. Surface it instead of silently flipping back.
   */
  if (!reg?.active) {
    /* Defensive: the switch is disabled when `supported` is false, so this is a race. */
    throw new Error('Notifications are not ready on this device yet. Reload the page.');
  }

  const preExisting = await reg.pushManager.getSubscription();
  const sub =
    preExisting ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
    }));

  try {
    await callEdgeFunction('push-subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
        platform: platformTag(),
      }),
    });
  } catch (err) {
    // Server didn't record the subscription — don't leave a local sub that gets
    // no pushes while the UI says "on". Roll back a sub we just created.
    if (!preExisting) {
      await sub.unsubscribe().catch(() => {});
    }
    throw new Error(
      err instanceof Error && err.message
        ? `Couldn't turn on notifications: ${err.message}`
        : "Couldn't turn on notifications. Please try again."
    );
  }

  pwaTelemetry('push-enabled', { platform: platformTag() });
  return getPushState();
}

/** Unsubscribe locally + server-side. Safe to call when not subscribed. */
export async function disablePush(): Promise<PushState> {
  const reg = await whenSwReady(PUSH_STATE_SW_TIMEOUT_MS);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch {
      // ignore — still tell the server to drop it
    }
    try {
      await callEdgeFunction('push-unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // best effort
    }
    pwaTelemetry('push-disabled');
  }
  return getPushState();
}

/**
 * Close OS notifications the user has already dealt with in the app (6.4): the
 * message they just read, or the whole tray after "mark all read". Falls back to
 * `getNotifications()` when no worker is controlling the page yet.
 */
export async function closeOsNotifications(tag?: string): Promise<void> {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
      controller.postMessage({ type: SW_MESSAGE.CLOSE_NOTIFICATIONS, tag });
      return;
    }
    const reg = await navigator.serviceWorker?.getRegistration();
    const notifications = await reg?.getNotifications(tag ? { tag } : undefined);
    for (const notification of notifications ?? []) notification.close();
  } catch {
    // Notification API unavailable — nothing to clear
  }
}

/**
 * Re-register the current subscription (called after `pushsubscriptionchange`,
 * or on app load to heal a subscription whose server row was pruned / whose
 * VAPID key rotated).
 */
export async function resyncPushSubscription(): Promise<void> {
  const caps = getPwaCapabilities();
  if (!caps.push || !VAPID_PUBLIC_KEY || Notification.permission !== 'granted') return;
  try {
    await enablePush();
  } catch {
    // non-fatal
  }
}
