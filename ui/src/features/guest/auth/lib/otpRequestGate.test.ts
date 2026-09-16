import { describe, expect, it, vi } from 'vitest';

import { sendOtpSingleFlight } from './otpRequestGate';

describe('sendOtpSingleFlight', () => {
  it('coalesces concurrent sends for the same normalized email', async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const send = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        })
    );

    const first = sendOtpSingleFlight(' Guest@Example.com ', send);
    const second = sendOtpSingleFlight('guest@example.com', send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    resolveRequest?.('sent');
    await expect(first).resolves.toBe('sent');

    const sendAgain = vi.fn(async () => 'sent again');
    await sendOtpSingleFlight('guest@example.com', sendAgain);
    expect(sendAgain).toHaveBeenCalledOnce();
  });

  it('does not coalesce different email addresses', async () => {
    const sendA = vi.fn(async () => 'a');
    const sendB = vi.fn(async () => 'b');

    await Promise.all([
      sendOtpSingleFlight('a@example.com', sendA),
      sendOtpSingleFlight('b@example.com', sendB),
    ]);

    expect(sendA).toHaveBeenCalledOnce();
    expect(sendB).toHaveBeenCalledOnce();
  });
});
