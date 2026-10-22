import { describe, expect, it } from 'vitest';

import { isLowSpecDevice } from '@/features/dashboard/marketing/lib/marketingDeviceTier';

describe('isLowSpecDevice', () => {
  it('flags little memory, few cores or Data Saver', () => {
    expect(isLowSpecDevice({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe(true);
    expect(isLowSpecDevice({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe(true);
    expect(isLowSpecDevice({ connection: { saveData: true } })).toBe(true);
  });

  it('treats capable or unknown devices as full mode', () => {
    expect(isLowSpecDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(isLowSpecDevice({})).toBe(false);
    expect(isLowSpecDevice(undefined)).toBe(false);
  });
});
