import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';

export type OrgPlansCheckoutReturn = 'success' | 'cancelled';

/** Absolute return URL after PayMongo Hosted Checkout (org Plans & Billing). */
export function orgPlansBillingCheckoutUrl(
  orgSlug: string,
  result: OrgPlansCheckoutReturn
): string {
  const origin = resolvePublicGuestAppOrigin(null);
  const params = new URLSearchParams({
    tab: 'billing',
    checkout: result,
  });
  return `${origin}/org/${encodeURIComponent(orgSlug)}/plans?${params.toString()}`;
}
