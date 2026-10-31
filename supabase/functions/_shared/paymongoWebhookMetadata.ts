/**
 * Shared PayMongo webhook payload digging — used by both `subscriptionOrchestrator.ts` (org
 * subscriptions) and `parkingPaymentOrchestrator.ts` (parking payments) so the metadata-reading
 * shape isn't duplicated per orchestrator.
 */

export type PaymongoWebhookInner = {
  inner: Record<string, unknown> | undefined;
  innerAttrs: Record<string, unknown> | undefined;
  metadata: unknown;
};

/** Digs into the `data.attributes.data.attributes` nesting PayMongo webhook payloads use. */
export function extractWebhookInner(payload: Record<string, unknown>): PaymongoWebhookInner {
  const attrs = (payload.data as Record<string, unknown> | undefined)?.attributes as
    Record<string, unknown> | undefined;
  const inner = attrs?.data as Record<string, unknown> | undefined;
  const innerAttrs = inner?.attributes as Record<string, unknown> | undefined;
  const metadata = innerAttrs?.metadata ?? attrs?.metadata;
  return { inner, innerAttrs, metadata };
}

export function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** `metadata.kind` — dispatch key so the webhook handler routes to the right orchestrator. */
export function readWebhookKind(payload: Record<string, unknown>): string | null {
  const { metadata } = extractWebhookInner(payload);
  return readMetadataString(metadata, 'kind');
}
