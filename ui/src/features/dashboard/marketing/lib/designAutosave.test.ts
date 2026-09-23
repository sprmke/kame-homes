import { describe, expect, it } from 'vitest';

import { readDesignSourcePreset, readDesignTemplateId, isDesignCustomTemplate, isDesignPresetAutosave, designAutosaveGroupKey, findDesignAutosaveTemplate, planDesignTemplateDedupe, planDesignAutosavePurge, DESIGN_CUSTOM_SOURCE_PRESET_ID } from '@/features/dashboard/marketing/lib/designAutosave';

describe('readDesignSourcePreset', () => {

  it('readDesignSourcePreset is exported', () => {
    expect(typeof readDesignSourcePreset).toBe('function');
  });

});

describe('readDesignTemplateId', () => {

  it('readDesignTemplateId is exported', () => {
    expect(typeof readDesignTemplateId).toBe('function');
  });

});

describe('isDesignCustomTemplate', () => {

  it('isDesignCustomTemplate is exported', () => {
    expect(typeof isDesignCustomTemplate).toBe('function');
  });

});

describe('isDesignPresetAutosave', () => {

  it('isDesignPresetAutosave is exported', () => {
    expect(typeof isDesignPresetAutosave).toBe('function');
  });

});

describe('designAutosaveGroupKey', () => {

  it('designAutosaveGroupKey is exported', () => {
    expect(typeof designAutosaveGroupKey).toBe('function');
  });

});

describe('findDesignAutosaveTemplate', () => {

  it('findDesignAutosaveTemplate is exported', () => {
    expect(typeof findDesignAutosaveTemplate).toBe('function');
  });

});

describe('planDesignTemplateDedupe', () => {

  it('planDesignTemplateDedupe is exported', () => {
    expect(typeof planDesignTemplateDedupe).toBe('function');
  });

});

describe('planDesignAutosavePurge', () => {

  it('planDesignAutosavePurge is exported', () => {
    expect(typeof planDesignAutosavePurge).toBe('function');
  });

});

describe('DESIGN_CUSTOM_SOURCE_PRESET_ID', () => {
  it('is defined', () => {
    expect(DESIGN_CUSTOM_SOURCE_PRESET_ID).toBeDefined();
  });
});
