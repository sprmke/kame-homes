import { describe, expect, it } from 'vitest';

import { registerCanvasTemplateSize, addEditableText, addPill, addSlotCard, addBanner, getDesignCanvasSize, fitCanvasPreview, addBlankText, deleteActiveObjects, serializeCanvas } from '@/features/dashboard/marketing/lib/designCanvasService';

describe('registerCanvasTemplateSize', () => {

  it('registerCanvasTemplateSize is exported', () => {
    expect(typeof registerCanvasTemplateSize).toBe('function');
  });

});

describe('addEditableText', () => {

  it('addEditableText is exported', () => {
    expect(typeof addEditableText).toBe('function');
  });

});

describe('addPill', () => {

  it('addPill is exported', () => {
    expect(typeof addPill).toBe('function');
  });

});

describe('addSlotCard', () => {

  it('addSlotCard is exported', () => {
    expect(typeof addSlotCard).toBe('function');
  });

});

describe('addBanner', () => {

  it('addBanner is exported', () => {
    expect(typeof addBanner).toBe('function');
  });

});

describe('getDesignCanvasSize', () => {

  it('getDesignCanvasSize is exported', () => {
    expect(typeof getDesignCanvasSize).toBe('function');
  });

});

describe('fitCanvasPreview', () => {

  it('fitCanvasPreview is exported', () => {
    expect(typeof fitCanvasPreview).toBe('function');
  });

});

describe('addBlankText', () => {

  it('addBlankText is exported', () => {
    expect(typeof addBlankText).toBe('function');
  });

});

describe('deleteActiveObjects', () => {

  it('deleteActiveObjects is exported', () => {
    expect(typeof deleteActiveObjects).toBe('function');
  });

});

describe('serializeCanvas', () => {

  it('serializeCanvas is exported', () => {
    expect(typeof serializeCanvas).toBe('function');
  });

});
