import { describe, expect, it } from 'vitest';

import { createSceneId, sceneDurationInFrames, transitionDurationInFrames, videoProjectDurationInFrames, sceneStartFrame, sceneSettledPreviewFrame, sceneEndFrame, sceneFrameRange, sceneIndexAtFrame, updateScene, reorderScenes, removeScene, addPhotoScene, defaultFps } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

describe('createSceneId', () => {

  it('createSceneId is exported', () => {
    expect(typeof createSceneId).toBe('function');
  });

});

describe('sceneDurationInFrames', () => {

  it('sceneDurationInFrames is exported', () => {
    expect(typeof sceneDurationInFrames).toBe('function');
  });

});

describe('transitionDurationInFrames', () => {

  it('transitionDurationInFrames is exported', () => {
    expect(typeof transitionDurationInFrames).toBe('function');
  });

});

describe('videoProjectDurationInFrames', () => {

  it('videoProjectDurationInFrames is exported', () => {
    expect(typeof videoProjectDurationInFrames).toBe('function');
  });

});

describe('sceneStartFrame', () => {

  it('sceneStartFrame is exported', () => {
    expect(typeof sceneStartFrame).toBe('function');
  });

});

describe('sceneSettledPreviewFrame', () => {

  it('sceneSettledPreviewFrame is exported', () => {
    expect(typeof sceneSettledPreviewFrame).toBe('function');
  });

});

describe('sceneEndFrame', () => {

  it('sceneEndFrame is exported', () => {
    expect(typeof sceneEndFrame).toBe('function');
  });

});

describe('sceneFrameRange', () => {

  it('sceneFrameRange is exported', () => {
    expect(typeof sceneFrameRange).toBe('function');
  });

});

describe('sceneIndexAtFrame', () => {

  it('sceneIndexAtFrame is exported', () => {
    expect(typeof sceneIndexAtFrame).toBe('function');
  });

});

describe('updateScene', () => {

  it('updateScene is exported', () => {
    expect(typeof updateScene).toBe('function');
  });

});

describe('reorderScenes', () => {

  it('reorderScenes is exported', () => {
    expect(typeof reorderScenes).toBe('function');
  });

});

describe('removeScene', () => {

  it('removeScene is exported', () => {
    expect(typeof removeScene).toBe('function');
  });

});

describe('addPhotoScene', () => {

  it('addPhotoScene is exported', () => {
    expect(typeof addPhotoScene).toBe('function');
  });

});

describe('defaultFps', () => {

  it('defaultFps is exported', () => {
    expect(typeof defaultFps).toBe('function');
  });

});
