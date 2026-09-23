import { describe, expect, it } from 'vitest';

import { foregroundFor, campaignAccentLight, resolveCampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';

describe('foregroundFor', () => {

  it('foregroundFor is exported', () => {
    expect(typeof foregroundFor).toBe('function');
  });

});

describe('campaignAccentLight', () => {

  it('campaignAccentLight is exported', () => {
    expect(typeof campaignAccentLight).toBe('function');
  });

});

describe('resolveCampaignPalette', () => {

  it('resolveCampaignPalette is exported', () => {
    expect(typeof resolveCampaignPalette).toBe('function');
  });

});
