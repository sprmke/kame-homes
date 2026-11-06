/**
 * Default finance categories for the transaction form.
 *
 * Ordered by how often short-stay hosts use them; the rest follow alphabetically.
 * `Other` stays last. Hosts can still type a custom category.
 * Taxonomy follows common STR charts of accounts (Schedule E lines plus the
 * platform/management costs short-stay hosts actually track).
 */
export const FINANCE_CATEGORY_SUGGESTIONS = [
  'Rent',
  'Amortization',
  'Utilities',
  'Supplies',
  'Maintenance',
  'Cleaning',
  'Staff',
  'Marketing',
  'Association dues',
  'Bank fees',
  'Furniture',
  'Insurance',
  'Management fee',
  'Platform fees',
  'Professional fees',
  'Software',
  'Taxes',
  'Transportation',
  'Other',
] as const;

export type FinanceCategorySuggestion = (typeof FINANCE_CATEGORY_SUGGESTIONS)[number];
