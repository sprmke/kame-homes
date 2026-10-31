import { describe, expect, it, vi } from 'vitest';

import {
  automationSkipLabelsForKinds,
  notifyAutomationSkippedByPlan,
  notifyAutomationSkippedByHost,
  workflowEmailKindFromSkipKey,
  AUTOMATION_SKIP_SESSION_KEY,
} from '@/features/dashboard/bookings/lib/workflowPlanSkip';

describe('automationSkipLabelsForKinds', () => {
  it('automationSkipLabelsForKinds is exported', () => {
    expect(typeof automationSkipLabelsForKinds).toBe('function');
  });
});

describe('notifyAutomationSkippedByPlan', () => {
  it('notifyAutomationSkippedByPlan is exported', () => {
    expect(typeof notifyAutomationSkippedByPlan).toBe('function');
  });
});

describe('notifyAutomationSkippedByHost', () => {
  it('notifyAutomationSkippedByHost is exported', () => {
    expect(typeof notifyAutomationSkippedByHost).toBe('function');
  });
});

describe('workflowEmailKindFromSkipKey', () => {
  it('workflowEmailKindFromSkipKey is exported', () => {
    expect(typeof workflowEmailKindFromSkipKey).toBe('function');
  });
});

describe('AUTOMATION_SKIP_SESSION_KEY', () => {
  it('is defined', () => {
    expect(AUTOMATION_SKIP_SESSION_KEY).toBeDefined();
  });
});

describe('notifyEmailsFailed', () => {
  it('shows one error toast naming the failed emails, and nothing when none failed', async () => {
    vi.resetModules();
    const error = vi.fn();
    vi.doMock('sonner', () => ({ toast: { error, warning: vi.fn(), message: vi.fn() } }));
    const { notifyEmailsFailed } =
      await import('@/features/dashboard/bookings/lib/workflowPlanSkip');

    notifyEmailsFailed([]);
    expect(error).not.toHaveBeenCalled();

    notifyEmailsFailed(['booking_acknowledgement', 'ready_for_checkin']);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toBe(
      'Email not sent: Booking acknowledgement email, Ready-for-check-in email'
    );
    vi.doUnmock('sonner');
  });
});
