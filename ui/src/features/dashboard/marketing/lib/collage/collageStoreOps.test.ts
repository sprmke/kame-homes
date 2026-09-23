import { describe, expect, it } from 'vitest';

import { isStoreInCollageMode, getCollageSettings, getCollageCells, getSelectedCollageCellId, startCollageDocument, selectCollageCell, enterCellCropMode } from '@/features/dashboard/marketing/lib/collage/collageStoreOps';

describe('isStoreInCollageMode', () => {

  it('isStoreInCollageMode is exported', () => {
    expect(typeof isStoreInCollageMode).toBe('function');
  });

});

describe('getCollageSettings', () => {

  it('getCollageSettings is exported', () => {
    expect(typeof getCollageSettings).toBe('function');
  });

});

describe('getCollageCells', () => {

  it('getCollageCells is exported', () => {
    expect(typeof getCollageCells).toBe('function');
  });

});

describe('getSelectedCollageCellId', () => {

  it('getSelectedCollageCellId is exported', () => {
    expect(typeof getSelectedCollageCellId).toBe('function');
  });

});

describe('startCollageDocument', () => {

  it('startCollageDocument is exported', () => {
    expect(typeof startCollageDocument).toBe('function');
  });

});

describe('selectCollageCell', () => {

  it('selectCollageCell is exported', () => {
    expect(typeof selectCollageCell).toBe('function');
  });

});

describe('enterCellCropMode', () => {

  it('enterCellCropMode is exported', () => {
    expect(typeof enterCellCropMode).toBe('function');
  });

});
