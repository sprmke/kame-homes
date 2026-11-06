/**
 * Default maintenance categories for the reminder form.
 *
 * Ordered by trade/frequency: systems that break most often first, operational
 * buckets after, `Other` last. Hosts can still type a custom category.
 * Keeps the original short list and adds the standard property trade buckets
 * (aircon, general repairs, paint, structure, grounds, pool).
 */
export const MAINTENANCE_CATEGORY_SUGGESTIONS = [
  'Plumbing',
  'Electrical',
  'Aircon',
  'Appliance',
  'Cleaning',
  'Pest Control',
  'Repairs',
  'Painting',
  'Structural',
  'Landscaping',
  'Pool',
  'Safety',
  'Amenities',
  'Supplies',
  'Utilities',
  'Other',
] as const;

export type MaintenanceCategorySuggestion = (typeof MAINTENANCE_CATEGORY_SUGGESTIONS)[number];
