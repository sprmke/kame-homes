#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push (RFC 8292).
 *
 *   node scripts/pwa/generate-vapid-keys.mjs
 *
 * Prints three values — set them per environment, NEVER commit them:
 *
 *   VITE_VAPID_PUBLIC_KEY   → ui/.env.*            (base64url raw public key; the
 *                                                   browser passes it to
 *                                                   pushManager.subscribe)
 *   VAPID_KEYS              → Supabase secret / supabase/.env.local
 *                             (JWK pair JSON — imported by _shared/webPushService.ts)
 *   VAPID_SUBJECT           → Supabase secret     (mailto: or https: contact URL)
 *
 * Output is compatible with @negrel/webpush `importVapidKeys()` (ECDSA P-256 JWK).
 * Rotating the pair invalidates every existing push subscription; clients
 * re-subscribe automatically on next load (pushsubscriptionchange + a stale-key
 * check). See docs/architecture/pwa.md → "VAPID rotation".
 */
import { webcrypto as crypto } from 'node:crypto';

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);

const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
const rawPublic = await crypto.subtle.exportKey('raw', keyPair.publicKey);

const vapidKeys = JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk });

console.log('\n# ── ui/.env.development / .env.production ───────────────────────');
console.log(`VITE_VAPID_PUBLIC_KEY=${base64url(rawPublic)}`);
console.log('\n# ── Supabase secret (supabase/.env.local for local serve) ──────');
console.log(`VAPID_KEYS=${vapidKeys}`);
console.log('VAPID_SUBJECT=mailto:ops@example.com   # replace with a real contact');
console.log('');
