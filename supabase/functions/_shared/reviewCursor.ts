/**
 * Keyset cursor for review lists ordered by (timestamp, id). A timestamp-only
 * cursor drops rows that share the boundary value, and same-day check-outs all
 * close at the same second, so "To write" lists need the id tie-breaker.
 *
 * Wire format: `<ISO timestamp>|<uuid>`. Anything else decodes to null (first page).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewKeysetCursor = { at: string; id: string };

export function encodeReviewCursor(at: string, id: string): string {
  return `${at}|${id}`;
}

export function decodeReviewCursor(raw: string | null | undefined): ReviewKeysetCursor | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const sep = value.lastIndexOf('|');
  if (sep <= 0) return null;
  const at = value.slice(0, sep);
  const id = value.slice(sep + 1);
  if (!UUID_RE.test(id) || !Number.isFinite(Date.parse(at))) return null;
  return { at: new Date(at).toISOString(), id: id.toLowerCase() };
}

/** Ascending (at, id) comparison, matching Postgres row-value ordering. */
export function isAfterReviewCursor(
  row: { at: string; id: string },
  cursor: ReviewKeysetCursor | null
): boolean {
  if (!cursor) return true;
  const rowMs = Date.parse(row.at);
  const cursorMs = Date.parse(cursor.at);
  if (rowMs !== cursorMs) return rowMs > cursorMs;
  return row.id.toLowerCase() > cursor.id;
}
