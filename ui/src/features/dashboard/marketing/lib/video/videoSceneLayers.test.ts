import { describe, expect, it } from 'vitest';

import { createLayerId, migrateLegacySceneToLayers, getSceneLayers, persistSceneLayers, normalizeSceneLayers, defaultLayersForKind, sceneBackgroundLayer, sceneBackgroundIsActive, overlayLayersForScene, layerLabel, addSceneLayer, removeSceneLayer, updateSceneLayer, updateSceneLayerPosition, removeAllSceneLayers, applySceneKindLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';

describe('createLayerId', () => {

  it('createLayerId is exported', () => {
    expect(typeof createLayerId).toBe('function');
  });

});

describe('migrateLegacySceneToLayers', () => {

  it('migrateLegacySceneToLayers is exported', () => {
    expect(typeof migrateLegacySceneToLayers).toBe('function');
  });

});

describe('getSceneLayers', () => {

  it('getSceneLayers is exported', () => {
    expect(typeof getSceneLayers).toBe('function');
  });

});

describe('persistSceneLayers', () => {

  it('persistSceneLayers is exported', () => {
    expect(typeof persistSceneLayers).toBe('function');
  });

});

describe('normalizeSceneLayers', () => {

  it('normalizeSceneLayers is exported', () => {
    expect(typeof normalizeSceneLayers).toBe('function');
  });

});

describe('defaultLayersForKind', () => {

  it('defaultLayersForKind is exported', () => {
    expect(typeof defaultLayersForKind).toBe('function');
  });

});

describe('sceneBackgroundLayer', () => {

  it('sceneBackgroundLayer is exported', () => {
    expect(typeof sceneBackgroundLayer).toBe('function');
  });

});

describe('sceneBackgroundIsActive', () => {

  it('sceneBackgroundIsActive is exported', () => {
    expect(typeof sceneBackgroundIsActive).toBe('function');
  });

});

describe('overlayLayersForScene', () => {

  it('overlayLayersForScene is exported', () => {
    expect(typeof overlayLayersForScene).toBe('function');
  });

});

describe('layerLabel', () => {

  it('layerLabel is exported', () => {
    expect(typeof layerLabel).toBe('function');
  });

});

describe('addSceneLayer', () => {

  it('addSceneLayer is exported', () => {
    expect(typeof addSceneLayer).toBe('function');
  });

});

describe('removeSceneLayer', () => {

  it('removeSceneLayer is exported', () => {
    expect(typeof removeSceneLayer).toBe('function');
  });

});

describe('updateSceneLayer', () => {

  it('updateSceneLayer is exported', () => {
    expect(typeof updateSceneLayer).toBe('function');
  });

});

describe('updateSceneLayerPosition', () => {

  it('updateSceneLayerPosition is exported', () => {
    expect(typeof updateSceneLayerPosition).toBe('function');
  });

});

describe('removeAllSceneLayers', () => {

  it('removeAllSceneLayers is exported', () => {
    expect(typeof removeAllSceneLayers).toBe('function');
  });

});

describe('applySceneKindLayers', () => {

  it('applySceneKindLayers is exported', () => {
    expect(typeof applySceneKindLayers).toBe('function');
  });

});
