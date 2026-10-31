import { describe, expect, it } from 'vitest';

import {
  workflowTransitionEmailEffects,
  workflowWouldEmailOnPaidPlan,
  workflowTransitionEffectLines,
  workflowCancelEffectLines,
} from '@/features/dashboard/bookings/lib/workflowTransitionEffectsCopy';

describe('workflowTransitionEmailEffects', () => {
  it('workflowTransitionEmailEffects is exported', () => {
    expect(typeof workflowTransitionEmailEffects).toBe('function');
  });
});

describe('workflowWouldEmailOnPaidPlan', () => {
  it('workflowWouldEmailOnPaidPlan is exported', () => {
    expect(typeof workflowWouldEmailOnPaidPlan).toBe('function');
  });
});

describe('workflowTransitionEffectLines', () => {
  it('workflowTransitionEffectLines is exported', () => {
    expect(typeof workflowTransitionEffectLines).toBe('function');
  });
});

describe('workflowCancelEffectLines', () => {
  it('workflowCancelEffectLines is exported', () => {
    expect(typeof workflowCancelEffectLines).toBe('function');
  });
});

describe('stay guide line by plan', () => {
  const toRfci = {
    fromStatus: 'PENDING_DOCUMENTS' as const,
    toStatus: 'READY_FOR_CHECKIN' as const,
    direction: 'forward' as const,
    booking: {
      has_pets: false,
      need_parking: false,
      security_deposit: null,
      sd_refund_form_emailed_at: null,
    },
    documentRequirements: [],
  };
  const line = 'Prepares a stay guide link for the guest.';

  it('lists the stay guide on Pro and above', () => {
    expect(workflowTransitionEffectLines(toRfci)).toContain(line);
  });

  it('omits it when the plan lacks propertyShowcase', () => {
    expect(workflowTransitionEffectLines({ ...toRfci, stayGuideAccess: false })).not.toContain(
      line
    );
  });
});
