/**
 * Templates OTP sudo window — mirrors super-admin sessionStorage reuse.
 * Server issues a 15-minute fixed token bound to `PROPERTY_TEMPLATES_SUDO_FINGERPRINT`.
 * Keep the fingerprint string in sync with `_shared/settingsVerification.ts`.
 */

/** Must match edge `PROPERTY_TEMPLATES_SUDO_FINGERPRINT`. */
export const PROPERTY_TEMPLATES_SUDO_FINGERPRINT = 'property_templates' as const;

const KEY_PREFIX = 'gfm.templatesOtp.';

function storageKey(propertyId: string): string {
  return `${KEY_PREFIX}${propertyId.trim()}`;
}

export function readTemplatesSudoToken(propertyId: string): string | null {
  const id = propertyId.trim();
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (!parsed.token || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(storageKey(id));
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function storeTemplatesSudoToken(
  propertyId: string,
  token: string,
  expiresAt: number
): void {
  const id = propertyId.trim();
  if (!id || !token || !expiresAt) return;
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage unavailable — host re-verifies more often.
  }
}

export function clearTemplatesSudoToken(propertyId: string): void {
  const id = propertyId.trim();
  if (!id) return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}

/** True when a Templates PATCH failed because the sudo token was missing/expired/mismatched. */
export function isTemplatesVerificationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /verificat/i.test(message);
}
