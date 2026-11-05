import { describe, expect, it, vi } from 'vitest';

import { captureError, captureMessage, captureRenderError, reactRootErrorHandlers } from './capture';

/**
 * No `VITE_SENTRY_DSN` in the unit environment, so every entry point must degrade to a
 * no-op. The real SDK path is covered by the browser drill in the observability manual.
 */
describe('sentry capture without a DSN', () => {
  it('returns undefined instead of throwing for every entry point', () => {
    expect(captureError(new Error('boom'))).toBeUndefined();
    expect(captureMessage('degraded')).toBeUndefined();
    expect(captureRenderError(new Error('render'), 'at Foo')).toBeUndefined();
  });

  it('tolerates non-Error values', () => {
    expect(captureError('a string')).toBeUndefined();
    expect(captureError({ weird: true })).toBeUndefined();
    expect(captureError(null)).toBeUndefined();
  });

  it('passes no root hooks so createRoot keeps its defaults', () => {
    expect(reactRootErrorHandlers()).toEqual({});
  });

  it('never calls the SDK when disabled', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureError(new Error('quiet'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
