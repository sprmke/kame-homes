import { describe, expect, it } from 'vitest';

import { computePaymentSettingsFingerprint } from '@/features/dashboard/org/lib/settingsVerificationFingerprint';

describe('settingsVerificationFingerprint', () => {
  it('hashes identical payment method lists the same way', async () => {
    const methods = [
      {
        id: 'm1',
        provider: 'gcash',
        accountName: 'Ada Lovelace',
        accountNumber: '09171234567',
        qrImageUrl: null,
        isPrimary: true,
      },
    ];
    const a = await computePaymentSettingsFingerprint(methods);
    const b = await computePaymentSettingsFingerprint(methods);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
