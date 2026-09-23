import { describe, expect, it } from 'vitest';

import { elementsCatalogForKind, defaultActiveElementsForKind, defaultHiddenElementsForKind, resolvedHiddenElements, activeElementsForScene, inactiveElementsForScene, sceneElementIsActive, sceneBackgroundIsActive, slotIsActive, removeSceneElement, addSceneElement, removeAllSceneElements, normalizeSceneElements, activeTextSlotsForScene } from '@/features/dashboard/marketing/lib/video/videoSceneElements';

describe('elementsCatalogForKind', () => {

  it('elementsCatalogForKind is exported', () => {
    expect(typeof elementsCatalogForKind).toBe('function');
  });

});

describe('defaultActiveElementsForKind', () => {

  it('defaultActiveElementsForKind is exported', () => {
    expect(typeof defaultActiveElementsForKind).toBe('function');
  });

});

describe('defaultHiddenElementsForKind', () => {

  it('defaultHiddenElementsForKind is exported', () => {
    expect(typeof defaultHiddenElementsForKind).toBe('function');
  });

});

describe('resolvedHiddenElements', () => {

  it('resolvedHiddenElements is exported', () => {
    expect(typeof resolvedHiddenElements).toBe('function');
  });

});

describe('activeElementsForScene', () => {

  it('activeElementsForScene is exported', () => {
    expect(typeof activeElementsForScene).toBe('function');
  });

});

describe('inactiveElementsForScene', () => {

  it('inactiveElementsForScene is exported', () => {
    expect(typeof inactiveElementsForScene).toBe('function');
  });

});

describe('sceneElementIsActive', () => {

  it('sceneElementIsActive is exported', () => {
    expect(typeof sceneElementIsActive).toBe('function');
  });

});

describe('sceneBackgroundIsActive', () => {

  it('sceneBackgroundIsActive is exported', () => {
    expect(typeof sceneBackgroundIsActive).toBe('function');
  });

});

describe('slotIsActive', () => {

  it('slotIsActive is exported', () => {
    expect(typeof slotIsActive).toBe('function');
  });

});

describe('removeSceneElement', () => {

  it('removeSceneElement is exported', () => {
    expect(typeof removeSceneElement).toBe('function');
  });

});

describe('addSceneElement', () => {

  it('addSceneElement is exported', () => {
    expect(typeof addSceneElement).toBe('function');
  });

});

describe('removeAllSceneElements', () => {

  it('removeAllSceneElements is exported', () => {
    expect(typeof removeAllSceneElements).toBe('function');
  });

});

describe('normalizeSceneElements', () => {

  it('normalizeSceneElements is exported', () => {
    expect(typeof normalizeSceneElements).toBe('function');
  });

});

describe('activeTextSlotsForScene', () => {

  it('activeTextSlotsForScene is exported', () => {
    expect(typeof activeTextSlotsForScene).toBe('function');
  });

});
