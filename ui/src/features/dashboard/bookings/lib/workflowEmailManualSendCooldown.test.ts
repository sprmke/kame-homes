import { describe, expect, it } from 'vitest';

import {
  WORKFLOW_EMAIL_MANUAL_RESEND_COOLDOWN_MS,
  resolveWorkflowEmailManualSendUi,
  workflowEmailManualCooldownRemainingMs,
} from '@/features/dashboard/bookings/lib/workflowEmailManualSendCooldown';

describe('workflowEmailManualSendCooldown', () => {
  it('reports remaining ms within the hour', () => {
    const now = Date.parse('2026-08-31T12:00:00.000Z');
    const sent = '2026-08-31T11:30:00.000Z';
    expect(workflowEmailManualCooldownRemainingMs(sent, now)).toBe(30 * 60 * 1000);
  });

  it('is zero after cooldown', () => {
    const now = Date.parse('2026-08-31T13:00:00.000Z');
    const sent = '2026-08-31T12:00:00.000Z';
    expect(
      workflowEmailManualCooldownRemainingMs(sent, now, WORKFLOW_EMAIL_MANUAL_RESEND_COOLDOWN_MS)
    ).toBe(0);
  });

  it('Free: Send then Resend with cooldown', () => {
    const now = Date.parse('2026-08-31T12:15:00.000Z');
    const locked = resolveWorkflowEmailManualSendUi('gaf_request', {
      enforceCooldown: true,
      sentAtMap: { gaf_request: '2026-08-31T12:00:00.000Z' },
      nowMs: now,
    });
    expect(locked.labelPrefix).toBe('Resend');
    expect(locked.inCooldown).toBe(true);
    expect(locked.cooldownReason).toMatch(/45 minutes/i);

    const open = resolveWorkflowEmailManualSendUi('gaf_request', {
      enforceCooldown: true,
      sentAtMap: { gaf_request: '2026-08-31T11:00:00.000Z' },
      nowMs: now,
    });
    expect(open.labelPrefix).toBe('Resend');
    expect(open.inCooldown).toBe(false);
  });

  it('Paid: no cooldown; SD prefers Resend label', () => {
    const ui = resolveWorkflowEmailManualSendUi('sd_refund_form_request', {
      enforceCooldown: false,
      sentAtMap: {},
      preferResendLabel: true,
    });
    expect(ui.labelPrefix).toBe('Resend');
    expect(ui.inCooldown).toBe(false);
  });
});
