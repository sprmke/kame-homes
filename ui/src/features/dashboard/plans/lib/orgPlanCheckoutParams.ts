export type OrgPlanCheckoutReturn = 'success' | 'cancelled';

export function parseOrgPlanCheckoutReturn(value: string | null): OrgPlanCheckoutReturn | null {
  if (value === 'success' || value === 'cancelled') return value;
  return null;
}
