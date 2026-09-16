/**
 * AES-256-GCM encrypt/decrypt for Meta inbox tokens at rest.
 * Key: META_INBOX_TOKEN_ENCRYPTION_KEY — 32 bytes as hex (64 chars) or standard base64.
 */

import { webCryptoRawKey } from './webCryptoKey.ts';

function decodeEncryptionKey(raw: string): Uint8Array {
  const t = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(t)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  const b64 = t.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  if (out.length !== 32) {
    throw new Error(
      'META_INBOX_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (use 64 hex chars or 32-byte base64)'
    );
  }
  return out;
}

async function importAesKey(rawKey: string): Promise<CryptoKey> {
  const material = decodeEncryptionKey(rawKey);
  return crypto.subtle.importKey('raw', webCryptoRawKey(material), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptMetaInboxToken(plaintext: string): Promise<string> {
  const keyRaw = Deno.env.get('META_INBOX_TOKEN_ENCRYPTION_KEY');
  if (!keyRaw) throw new Error('Missing META_INBOX_TOKEN_ENCRYPTION_KEY');
  const key = await importAesKey(keyRaw);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, enc.encode(plaintext))
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return toBase64Url(combined);
}

export async function decryptMetaInboxToken(ciphertextB64Url: string): Promise<string> {
  const keyRaw = Deno.env.get('META_INBOX_TOKEN_ENCRYPTION_KEY');
  if (!keyRaw) throw new Error('Missing META_INBOX_TOKEN_ENCRYPTION_KEY');
  const key = await importAesKey(keyRaw);
  const combined = fromBase64Url(ciphertextB64Url.trim());
  if (combined.length < 13) throw new Error('Invalid ciphertext');
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct);
  return new TextDecoder().decode(pt);
}
