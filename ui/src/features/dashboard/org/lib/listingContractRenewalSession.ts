const LEGACY_AUTO_SHOWN_PREFIX = 'listing-contract-renewal-auto';

const autoShownThisLogin = new Set<string>();

function loginAutoShownKey(userId: string, orgId: string, todayYmd: string): string {
  return `${userId}:${orgId}:${todayYmd}`;
}

/** True after a dismissible reminder was auto-shown for this auth login (Manila day). */
export function readOrgRenewalAutoShownThisLogin(
  userId: string,
  orgId: string,
  todayYmd: string
): boolean {
  return autoShownThisLogin.has(loginAutoShownKey(userId, orgId, todayYmd));
}

export function markOrgRenewalAutoShownThisLogin(
  userId: string,
  orgId: string,
  todayYmd: string
): void {
  autoShownThisLogin.add(loginAutoShownKey(userId, orgId, todayYmd));
}

export function clearOrgRenewalAutoShownForUser(userId: string): void {
  for (const key of autoShownThisLogin) {
    if (key.startsWith(`${userId}:`)) {
      autoShownThisLogin.delete(key);
    }
  }
}

/** Remove stale browser-session keys from an earlier implementation. */
export function clearLegacyOrgRenewalSessionStorage(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(`${LEGACY_AUTO_SHOWN_PREFIX}:`)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore quota / private mode
  }
}
