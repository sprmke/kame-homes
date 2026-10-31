import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { getPwaCapabilities } from '@/lib/pwa/capabilities';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { whenSwReady } from '@/lib/pwa/swRegistration';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

export type PushState = {
  supported: boolean;
  /** Push only works on iOS/iPadOS when the app is installed to the home screen. */
  needsInstallFirst: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
};

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
  if (!caps.push || !caps.serviceWorker || !VAPID_PUBLIC_KEY) {
    return {
      supported: false,
      needsInstallFirst: caps.isIos && !caps.standalone,
      permission: caps.notifications ? Notification.permission : 'unsupported',
      subscribed: false,
    };
  }
  const reg = await whenSwReady();
  const existing = await reg?.pushManager.getSubscription();
  return {
    supported: true,
    needsInstallFirst: caps.isIos && !caps.standalone,
    permission: Notification.permission,
    subscribed: !!existing,
  };
}

/**
 * Ask for permission (must be inside a user gesture on iOS), subscribe with the
 * VAPID key, and register the subscription server-side. Idempotent.
 */
export async function enablePush(): Promise<PushState> {
  const caps = getPwaCapabilities();
  if (!caps.push || !VAPID_PUBLIC_KEY) return getPushState();

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return getPushState();

  const reg = await whenSwReady();
  if (!reg) return getPushState();

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
  const reg = await whenSwReady();
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
