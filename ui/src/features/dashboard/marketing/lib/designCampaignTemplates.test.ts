import { describe, expect, it } from 'vitest';

import { campaignTemplatesForFormat, getCampaignTemplate, campaignTemplateBaseId } from '@/features/dashboard/marketing/lib/designCampaignTemplates';

describe('campaignTemplatesForFormat', () => {

  it('campaignTemplatesForFormat is exported', () => {
    expect(typeof campaignTemplatesForFormat).toBe('function');
  });

});

describe('getCampaignTemplate', () => {

  it('getCampaignTemplate is exported', () => {
    expect(typeof getCampaignTemplate).toBe('function');
  });

});

describe('campaignTemplateBaseId', () => {

  it('campaignTemplateBaseId is exported', () => {
    expect(typeof campaignTemplateBaseId).toBe('function');
  });

});
