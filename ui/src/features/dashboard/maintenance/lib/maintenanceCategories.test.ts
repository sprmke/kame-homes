import { describe, expect, it } from 'vitest';

import { MAINTENANCE_CATEGORY_SUGGESTIONS } from '@/features/dashboard/maintenance/lib/maintenanceCategories';

describe('MAINTENANCE_CATEGORY_SUGGESTIONS', () => {
  it('keeps the original defaults hosts already use', () => {
    expect(MAINTENANCE_CATEGORY_SUGGESTIONS).toEqual(
      expect.arrayContaining([
        'Supplies',
        'Utilities',
        'Appliance',
        'Amenities',
        'Cleaning',
        'Pest Control',
        'Safety',
        'Plumbing',
        'Electrical',
      ])
    );
  });

  it('includes the standard property trade buckets', () => {
    expect(MAINTENANCE_CATEGORY_SUGGESTIONS).toEqual(
      expect.arrayContaining(['Aircon', 'Repairs', 'Painting', 'Structural', 'Landscaping', 'Pool'])
    );
  });

  it('ends with Other and never repeats a value', () => {
    expect(MAINTENANCE_CATEGORY_SUGGESTIONS.at(-1)).toBe('Other');

    const normalized = MAINTENANCE_CATEGORY_SUGGESTIONS.map((value) => value.trim().toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('fits the category field limits', () => {
    for (const value of MAINTENANCE_CATEGORY_SUGGESTIONS) {
      expect(value).toBe(value.trim());
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(80);
    }
  });
});
