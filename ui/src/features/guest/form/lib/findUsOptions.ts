/** Shared "How did you find us?" / referral channel options (guest form + admin edit). */
export const FIND_US_OPTIONS = [
  'Facebook',
  'Airbnb',
  'Tiktok',
  'Instagram',
  'Friend',
  'Others',
] as const;

export type FindUsOption = (typeof FIND_US_OPTIONS)[number];

export function isFindUsOption(value: string): value is FindUsOption {
  return (FIND_US_OPTIONS as readonly string[]).includes(value);
}

/** Friend / Others require a details field on the guest form. */
export function findUsRequiresDetails(value: string | null | undefined): boolean {
  return value === 'Friend' || value === 'Others';
}
