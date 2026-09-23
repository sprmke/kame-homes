import { describe, expect, it } from 'vitest';

import { buildCheckInPackContent, readPropertyCheckInTimes } from '@/features/dashboard/inbox/lib/inboxCheckInPack';

describe('buildCheckInPackContent', () => {

  it('buildCheckInPackContent is exported', () => {
    expect(typeof buildCheckInPackContent).toBe('function');
  });

});

describe('readPropertyCheckInTimes', () => {

  it('readPropertyCheckInTimes is exported', () => {
    expect(typeof readPropertyCheckInTimes).toBe('function');
  });

});
