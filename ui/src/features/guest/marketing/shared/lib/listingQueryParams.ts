/**
 * Generic URL parse/write helpers for public listing pages.
 * Defaults are omitted from the URL so share links stay clean (BookingsListPage pattern).
 */

export function parseCsvParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export function parseNonNegInt(raw: string | null, fallback = 0): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function parseOptionalNumber(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseOptionalYmd(raw: string | null): string {
  const value = (raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/** Set or delete a param; empty/null deletes. */
export function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined
): void {
  if (value == null || value === '') params.delete(key);
  else params.set(key, value);
}

/** Write CSV list; omit when empty. */
export function setCsvOrDelete(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length === 0) params.delete(key);
  else params.set(key, values.join(','));
}

/**
 * Write a param only when it differs from the default.
 * Numbers and strings compared with ===.
 */
export function setIfNotDefault(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
  defaultValue: string | number | null | undefined
): void {
  if (value == null || value === '' || value === defaultValue) {
    params.delete(key);
    return;
  }
  params.set(key, String(value));
}

export function parseSortAllowlist<T extends string>(
  raw: string | null,
  allowlist: readonly T[],
  fallback: T
): T {
  if (raw && (allowlist as readonly string[]).includes(raw)) return raw as T;
  return fallback;
}
