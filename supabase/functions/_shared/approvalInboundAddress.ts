/**
 * Per-property Resend inbound address for Azure GAF/pet approval replies.
 *
 * Env:
 *   RESEND_APPROVAL_INBOUND_DOMAIN — e.g. `inbound.kamehomes.space`
 *   → address `approvals+{propertySlug}@{domain}`
 */

export function approvalInboundLocalPart(propertySlug: string): string {
  const slug = propertySlug.trim().toLowerCase();
  return `approvals+${slug}`;
}

export function buildApprovalInboundAddress(propertySlug: string): string | null {
  const domain = (Deno.env.get('RESEND_APPROVAL_INBOUND_DOMAIN') ?? '').trim().toLowerCase();
  if (!domain) return null;
  const slug = propertySlug.trim().toLowerCase();
  if (!slug) return null;
  return `${approvalInboundLocalPart(slug)}@${domain}`;
}

/** Extract property slug from `approvals+{slug}@…` (or plain local-part variants). */
export function propertySlugFromInboundAddress(address: string): string | null {
  const email = address.trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const plus = local.indexOf('+');
  if (local.startsWith('approvals+') && plus >= 0) {
    const slug = local.slice(plus + 1).trim();
    return slug || null;
  }
  return null;
}

export function firstInboundRecipient(
  to: string[] | undefined,
  receivedFor: string[] | undefined
): string | null {
  for (const list of [receivedFor, to]) {
    for (const raw of list ?? []) {
      const addr = String(raw ?? '').trim();
      if (addr) return addr;
    }
  }
  return null;
}
