import { describe, expect, it } from 'vitest';

import { marketingSavedTemplateCategoryId, isSavedCollageTemplate, marketingVideoSavedCategoryId, marketingSavedTemplateAspect, marketingSavedTemplateMatchesFormat, marketingDesignSidebarRecords, planSavedTemplateRelatedIds } from '@/features/dashboard/marketing/lib/marketingSavedTemplates';

describe('marketingSavedTemplateCategoryId', () => {

  it('marketingSavedTemplateCategoryId is exported', () => {
    expect(typeof marketingSavedTemplateCategoryId).toBe('function');
  });

});

describe('isSavedCollageTemplate', () => {

  it('isSavedCollageTemplate is exported', () => {
    expect(typeof isSavedCollageTemplate).toBe('function');
  });

});

describe('marketingVideoSavedCategoryId', () => {

  it('marketingVideoSavedCategoryId is exported', () => {
    expect(typeof marketingVideoSavedCategoryId).toBe('function');
  });

});

describe('marketingSavedTemplateAspect', () => {

  it('marketingSavedTemplateAspect is exported', () => {
    expect(typeof marketingSavedTemplateAspect).toBe('function');
  });

});

describe('marketingSavedTemplateMatchesFormat', () => {

  it('marketingSavedTemplateMatchesFormat is exported', () => {
    expect(typeof marketingSavedTemplateMatchesFormat).toBe('function');
  });

});

describe('marketingDesignSidebarRecords', () => {

  it('marketingDesignSidebarRecords is exported', () => {
    expect(typeof marketingDesignSidebarRecords).toBe('function');
  });

});

describe('planSavedTemplateRelatedIds', () => {

  it('planSavedTemplateRelatedIds is exported', () => {
    expect(typeof planSavedTemplateRelatedIds).toBe('function');
  });

});
