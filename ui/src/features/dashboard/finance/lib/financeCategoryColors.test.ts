import { describe, expect, it } from 'vitest';

import { getFinanceCategoryLabel } from '@/features/dashboard/finance/lib/financeCategoryColors';

describe('getFinanceCategoryLabel', () => {

  it('getFinanceCategoryLabel is exported', () => {
    expect(typeof getFinanceCategoryLabel).toBe('function');
  });

});
