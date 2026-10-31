/**
 * AES-256-GCM encrypt/decrypt for property-scoped secrets at rest.
 * Uses GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY (32 bytes hex or base64).
 */

import { decryptIntegrationSecret, encryptIntegrationSecret } from './secretsCrypto.ts';

export async function encryptPropertySecret(plaintext: string): Promise<string> {
  return encryptIntegrationSecret(plaintext);
}

export async function decryptPropertySecret(
  ciphertext: string | null | undefined
): Promise<string | null> {
  const t = (ciphertext ?? '').trim();
  if (!t) return null;
  try {
    return await decryptIntegrationSecret(t);
  } catch (e) {
    console.error('[propertySecretCrypto] decrypt failed:', e);
    return null;
  }
}

export function propertySecretsEncryptionConfigured(): boolean {
  return !!Deno.env.get('GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY')?.trim();
}
