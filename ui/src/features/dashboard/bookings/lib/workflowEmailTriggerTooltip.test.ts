import { describe, expect, it } from 'vitest';

import {
  buildWorkflowEmailTriggerTooltip,
  resolveWorkflowEmailTriggerBlocker,
  workflowEmailTriggerTooltip,
} from '@/features/dashboard/bookings/lib/workflowEmailTriggerTooltip';

describe('buildWorkflowEmailTriggerTooltip', () => {
  it('returns action help when enabled', () => {
    expect(buildWorkflowEmailTriggerTooltip('Emails the guest.', null)).toBe('Emails the guest.');
  });

  it('merges action help with blocker when disabled', () => {
    expect(
      buildWorkflowEmailTriggerTooltip(
        'Emails the PMO the GAF request PDF.',
        'Upload Guest 2 valid ID on GAF Approval first.'
      )
    ).toBe('Emails the PMO the GAF request PDF. Upload Guest 2 valid ID on GAF Approval first.');
  });

  it('returns blocker alone when action help is empty', () => {
    expect(buildWorkflowEmailTriggerTooltip('', 'Proceed to Ready for Check-in first.')).toBe(
      'Proceed to Ready for Check-in first.'
    );
  });
});

describe('resolveWorkflowEmailTriggerBlocker', () => {
  it('prefers prerequisite over cooldown and in-flight send', () => {
    expect(
      resolveWorkflowEmailTriggerBlocker({
        enabled: false,
        disabledReason: 'Proceed from Pending Review first.',
        blockedByAnotherSend: true,
        cooldownBlocks: true,
        cooldownReason: 'Resend available in 45 minutes.',
      })
    ).toBe('Proceed from Pending Review first.');
  });

  it('returns cooldown when enabled but in cooldown', () => {
    expect(
      resolveWorkflowEmailTriggerBlocker({
        enabled: true,
        disabledReason: null,
        blockedByAnotherSend: false,
        cooldownBlocks: true,
        cooldownReason: 'Resend available in 45 minutes.',
      })
    ).toBe('Resend available in 45 minutes.');
  });

  it('returns in-flight message when another send is running', () => {
    expect(
      resolveWorkflowEmailTriggerBlocker({
        enabled: true,
        disabledReason: null,
        blockedByAnotherSend: true,
        cooldownBlocks: false,
        cooldownReason: null,
      })
    ).toBe('Wait for the current send to finish.');
  });
});

describe('workflowEmailTriggerTooltip', () => {
  it('includes help for every manual email kind', () => {
    for (const kind of [
      'booking_acknowledgement',
      'gaf_request',
      'pet_request',
      'ready_for_checkin',
      'sd_refund_form_request',
    ] as const) {
      const tooltip = workflowEmailTriggerTooltip(kind, 'Blocked for now.');
      expect(tooltip).toMatch(/\./);
      expect(tooltip).toContain('Blocked for now.');
    }
  });
});
