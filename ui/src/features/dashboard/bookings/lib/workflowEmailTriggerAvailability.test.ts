import { describe, expect, it } from 'vitest';

import { visibleManualWorkflowEmailKinds, resolveWorkflowEmailTriggerAvailability } from '@/features/dashboard/bookings/lib/workflowEmailTriggerAvailability';

describe('visibleManualWorkflowEmailKinds', () => {

  it('visibleManualWorkflowEmailKinds is exported', () => {
    expect(typeof visibleManualWorkflowEmailKinds).toBe('function');
  });

});

describe('resolveWorkflowEmailTriggerAvailability', () => {

  it('resolveWorkflowEmailTriggerAvailability is exported', () => {
    expect(typeof resolveWorkflowEmailTriggerAvailability).toBe('function');
  });

});
