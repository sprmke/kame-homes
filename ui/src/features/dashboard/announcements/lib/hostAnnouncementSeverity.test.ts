import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';

describe('hostAnnouncementSeverity', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
