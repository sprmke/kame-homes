import { describe, expect, it, vi } from 'vitest';

import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

describe('pwaTelemetry', () => {
  it('dispatches a window event with the event name and payload', () => {
    const listener = vi.fn();
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    win.addEventListener('gfm:pwa-telemetry', listener);

    pwaTelemetry('install-prompt-outcome', { outcome: 'accepted' });

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail).toMatchObject({ event: 'install-prompt-outcome', outcome: 'accepted' });
    expect(typeof detail.ts).toBe('number');
    vi.unstubAllGlobals();
  });

  it('never throws when dispatch is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(() => pwaTelemetry('installed')).not.toThrow();
    vi.unstubAllGlobals();
  });
});
