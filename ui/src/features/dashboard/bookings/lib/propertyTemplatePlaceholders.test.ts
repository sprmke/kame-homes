import { describe, expect, it } from 'vitest';

import { applyPropertyTemplatePlaceholders } from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';

describe('applyPropertyTemplatePlaceholders', () => {

  it('applyPropertyTemplatePlaceholders is exported', () => {
    expect(typeof applyPropertyTemplatePlaceholders).toBe('function');
  });

});
