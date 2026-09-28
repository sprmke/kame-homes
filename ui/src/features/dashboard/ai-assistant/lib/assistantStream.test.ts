import { describe, expect, it } from 'vitest';

import {
  isAbortError,
  isInterruptedStreamError,
  humanizeAssistantStreamError,
  buildTurnProgressFromStreamEvent,
  withActiveTurnStep,
} from '@/features/dashboard/ai-assistant/lib/assistantStream';

describe('withActiveTurnStep', () => {
  it('adds a reviewing row when every step has finished', () => {
    const steps = withActiveTurnStep([
      { id: 'a', label: 'Searched bookings', status: 'done' },
      { id: 'b', label: 'Checked available moves', status: 'failed' },
    ]);
    expect(steps.map((s) => s.status)).toEqual(['done', 'failed', 'active']);
    expect(steps[2]?.label).toBe('Reviewing results');
  });

  it('promotes the next planned step instead of adding a row', () => {
    const steps = withActiveTurnStep([
      { id: 'a', label: 'Search bookings', status: 'done' },
      { id: 'b', label: 'Map pipeline', status: 'pending' },
      { id: 'c', label: 'Check moves', status: 'pending' },
    ]);
    expect(steps.map((s) => s.status)).toEqual(['done', 'active', 'pending']);
  });

  it('leaves steps alone when one is already active or there are none', () => {
    const active = [{ id: 'a', label: 'Searching bookings', status: 'active' as const }];
    expect(withActiveTurnStep(active)).toBe(active);
    expect(withActiveTurnStep([])).toEqual([]);
  });
});

describe('buildTurnProgressFromStreamEvent failure reasons', () => {
  const reason = 'This check works on one listing at a time, so it was skipped.';

  it('keeps the host-facing reason on a failed tool step', () => {
    const started = buildTurnProgressFromStreamEvent(null, {
      type: 'tool_start',
      toolName: 'get_finance_summary',
      label: 'Checking finance summary…',
      stepId: 'r0-t0',
    });
    const failed = buildTurnProgressFromStreamEvent(started, {
      type: 'tool_done',
      toolName: 'get_finance_summary',
      ok: false,
      durationMs: 40,
      stepId: 'r0-t0',
      reason,
    });
    expect(failed?.steps[0]).toMatchObject({ status: 'failed', reason });

    const rerun = buildTurnProgressFromStreamEvent(failed, {
      type: 'tool_start',
      toolName: 'get_finance_summary',
      label: 'Checking finance summary…',
      stepId: 'r1-t0',
    });
    expect(rerun?.steps[0]?.status).toBe('active');
    expect(rerun?.steps[0]?.reason).toBeUndefined();
  });

  it('carries the reason on plan updates', () => {
    const plan = buildTurnProgressFromStreamEvent(null, {
      type: 'plan',
      title: 'Working on your request',
      steps: [
        { id: 'r0-t0', label: 'Check finance', status: 'running', toolName: 'get_finance_summary' },
      ],
    });
    const failed = buildTurnProgressFromStreamEvent(plan, {
      type: 'plan_update',
      stepId: 'r0-t0',
      status: 'failed',
      reason,
    });
    expect(failed?.steps[0]).toMatchObject({ status: 'failed', reason });
  });
});

describe('isAbortError', () => {
  it('isAbortError is exported', () => {
    expect(typeof isAbortError).toBe('function');
  });
});

describe('isInterruptedStreamError', () => {
  it('isInterruptedStreamError is exported', () => {
    expect(typeof isInterruptedStreamError).toBe('function');
  });
});

describe('humanizeAssistantStreamError', () => {
  it('humanizeAssistantStreamError is exported', () => {
    expect(typeof humanizeAssistantStreamError).toBe('function');
  });
});

describe('buildTurnProgressFromStreamEvent', () => {
  it('buildTurnProgressFromStreamEvent is exported', () => {
    expect(typeof buildTurnProgressFromStreamEvent).toBe('function');
  });
});
