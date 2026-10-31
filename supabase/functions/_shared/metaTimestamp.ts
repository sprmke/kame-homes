/**
 * Meta webhook timestamps are Unix seconds; normalize before persisting.
 */

export function normalizeMetaWebhookTimestamp(ts: number): string {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}

export function metaMessagingWindowExpiry(fromIso: string): string {
  const d = new Date(fromIso);
  d.setHours(d.getHours() + 24);
  return d.toISOString();
}
