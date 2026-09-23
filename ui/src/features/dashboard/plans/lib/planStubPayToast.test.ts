import { describe, expect, it } from 'vitest';

import { toastPlanPaymentComingSoon } from '@/features/dashboard/plans/lib/planStubPayToast';

describe('toastPlanPaymentComingSoon', () => {

  it('toastPlanPaymentComingSoon is exported', () => {
    expect(typeof toastPlanPaymentComingSoon).toBe('function');
  });

});
