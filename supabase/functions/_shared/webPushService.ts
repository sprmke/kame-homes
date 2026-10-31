/**
 * Web Push sender (RFC 8291 / 8292) for the PWA notification fan-out.
 *
 * Thin wrapper around @negrel/webpush (Web-Crypto based — the right fit for the
 * Deno edge runtime). Isolated on purpose: if the library ever misbehaves in
 * production, swapping the implementation is a single-file change. See
 * docs/architecture/pwa.md → "Push pipeline".
 */
import {
  ApplicationServer,
  type PushSubscription as WebPushSubscription,
  PushMessageError,
} from 'https://esm.sh/jsr/@negrel/webpush@0.5.0';

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult =
  { ok: true; id: string } | { ok: false; id: string; gone: boolean; error: string };

/** Notification payload the service worker's `push` handler expects. */
export type PushPayload = {
  title: string;
  body?: string;
  /** Absolute or app-relative path to open on click. */
  path?: string;
  tag?: string;
  notificationId?: string;
  type?: string;
};

let appServerPromise: Promise<ApplicationServer> | null = null;

function readVapidEnv(): {
  keys: { publicKey: JsonWebKey; privateKey: JsonWebKey };
  subject: string;
} {
  const raw = Deno.env.get('VAPID_KEYS');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? '';
  if (!raw) throw new Error('VAPID_KEYS is not set');
  if (!subject) throw new Error('VAPID_SUBJECT is not set');
  let parsed: { publicKey?: JsonWebKey; privateKey?: JsonWebKey };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('VAPID_KEYS is not valid JSON');
  }
  if (!parsed.publicKey || !parsed.privateKey) {
    throw new Error('VAPID_KEYS must be { publicKey, privateKey } JWK pair');
  }
  return { keys: { publicKey: parsed.publicKey, privateKey: parsed.privateKey }, subject };
}

async function importVapidKeyPair(jwk: {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}): Promise<CryptoKeyPair> {
  const algo = { name: 'ECDSA', namedCurve: 'P-256' } as const;
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.importKey('jwk', jwk.publicKey, algo, true, ['verify']),
    crypto.subtle.importKey('jwk', jwk.privateKey, algo, false, ['sign']),
  ]);
  return { publicKey, privateKey };
}

export function isPushConfigured(): boolean {
  return !!Deno.env.get('VAPID_KEYS') && !!Deno.env.get('VAPID_SUBJECT');
}

async function getApplicationServer(): Promise<ApplicationServer> {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const { keys, subject } = readVapidEnv();
      const vapidKeys = await importVapidKeyPair(keys);
      return ApplicationServer.new({ contactInformation: subject, vapidKeys });
    })().catch((err) => {
      appServerPromise = null; // allow retry on the next request
      throw err;
    });
  }
  return appServerPromise;
}

/** Send one push. Never throws — the caller decides what to do with a failure. */
export async function sendPush(
  sub: StoredPushSubscription,
  payload: PushPayload
): Promise<PushSendResult> {
  try {
    const server = await getApplicationServer();
    const target: WebPushSubscription = {
      endpoint: sub.endpoint,
      expirationTime: null,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    // `urgency` omitted — the library defaults to Urgency.Normal.
    await server.subscribe(target).pushTextMessage(JSON.stringify(payload), { ttl: 12 * 60 * 60 });
    return { ok: true, id: sub.id };
  } catch (err) {
    const gone = err instanceof PushMessageError && err.isGone();
    return { ok: false, id: sub.id, gone, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Send to many endpoints with bounded concurrency so a large org can't stampede a push service. */
export async function sendPushBatch(
  subs: StoredPushSubscription[],
  payload: PushPayload,
  concurrency = 20
): Promise<PushSendResult[]> {
  const results: PushSendResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, subs.length) }, async () => {
    while (cursor < subs.length) {
      const idx = cursor;
      cursor += 1;
      results.push(await sendPush(subs[idx], payload));
    }
  });
  await Promise.all(workers);
  return results;
}
