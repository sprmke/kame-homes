/**
 * Admin operator settings validation — keep in sync with
 * supabase/functions/_shared/appSettings.ts (email / URL helpers).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOptionalAdminEmail(raw: string, label: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!EMAIL_RE.test(value)) return `Invalid ${label}`;
  return null;
}

export function validateAdminEmailList(raw: string, label: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of parts) {
    if (!EMAIL_RE.test(entry)) return `Invalid ${label} address: ${entry}`;
  }
  return null;
}

export function validateOptionalAdminUrl(raw: string, label: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `${label} must use http or https`;
    }
  } catch {
    return `Invalid ${label} URL`;
  }
  return null;
}

export function validateRequiredAdminUrl(
  raw: string,
  label: string,
  emptyMessage: string
): string | null {
  const value = raw.trim();
  if (!value) return emptyMessage;
  return validateOptionalAdminUrl(raw, label);
}
