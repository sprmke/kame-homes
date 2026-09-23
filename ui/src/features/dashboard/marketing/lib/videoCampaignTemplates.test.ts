import { describe, expect, it } from 'vitest';

import { videoTemplatesForCategory, videoTemplatePalette, defaultVideoFields, getVideoCampaignTemplate } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

describe('videoTemplatesForCategory', () => {

  it('videoTemplatesForCategory is exported', () => {
    expect(typeof videoTemplatesForCategory).toBe('function');
  });

});

describe('videoTemplatePalette', () => {

  it('videoTemplatePalette is exported', () => {
    expect(typeof videoTemplatePalette).toBe('function');
  });

});

describe('defaultVideoFields', () => {

  it('defaultVideoFields is exported', () => {
    expect(typeof defaultVideoFields).toBe('function');
  });

});

describe('getVideoCampaignTemplate', () => {

  it('getVideoCampaignTemplate is exported', () => {
    expect(typeof getVideoCampaignTemplate).toBe('function');
  });

});
