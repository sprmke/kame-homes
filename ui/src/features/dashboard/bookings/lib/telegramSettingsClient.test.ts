import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/bookings/lib/telegramSettingsClient';

describe('telegramSettingsClient', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
