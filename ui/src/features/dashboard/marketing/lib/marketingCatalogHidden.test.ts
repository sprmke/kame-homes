import { describe, expect, it } from 'vitest';

import { isHiddenCategoryId, HIDDEN_CATEGORY_ID } from '@/features/dashboard/marketing/lib/marketingCatalogHidden';

describe('isHiddenCategoryId', () => {

  it('isHiddenCategoryId is exported', () => {
    expect(typeof isHiddenCategoryId).toBe('function');
  });

});

describe('HIDDEN_CATEGORY_ID', () => {
  it('is defined', () => {
    expect(HIDDEN_CATEGORY_ID).toBeDefined();
  });
});
