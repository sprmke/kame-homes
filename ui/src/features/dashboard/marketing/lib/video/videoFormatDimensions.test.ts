import { describe, expect, it } from 'vitest';

import { stepVideoZoomIn, stepVideoZoomOut, fitVideoPreviewFrameSize, VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS, VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS, VIDEO_FORMAT_OPTIONS, VIDEO_MIN_RELATIVE_ZOOM, VIDEO_MAX_RELATIVE_ZOOM, VIDEO_ZOOM_STEP } from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';

describe('stepVideoZoomIn', () => {

  it('stepVideoZoomIn is exported', () => {
    expect(typeof stepVideoZoomIn).toBe('function');
  });

});

describe('stepVideoZoomOut', () => {

  it('stepVideoZoomOut is exported', () => {
    expect(typeof stepVideoZoomOut).toBe('function');
  });

});

describe('fitVideoPreviewFrameSize', () => {

  it('fitVideoPreviewFrameSize is exported', () => {
    expect(typeof fitVideoPreviewFrameSize).toBe('function');
  });

});

describe('VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS', () => {
  it('is defined', () => {
    expect(VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS).toBeDefined();
  });
});

describe('VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS', () => {
  it('is defined', () => {
    expect(VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS).toBeDefined();
  });
});

describe('VIDEO_FORMAT_OPTIONS', () => {
  it('is defined', () => {
    expect(VIDEO_FORMAT_OPTIONS).toBeDefined();
  });
});

describe('VIDEO_MIN_RELATIVE_ZOOM', () => {
  it('is defined', () => {
    expect(VIDEO_MIN_RELATIVE_ZOOM).toBeDefined();
  });
});

describe('VIDEO_MAX_RELATIVE_ZOOM', () => {
  it('is defined', () => {
    expect(VIDEO_MAX_RELATIVE_ZOOM).toBeDefined();
  });
});

describe('VIDEO_ZOOM_STEP', () => {
  it('is defined', () => {
    expect(VIDEO_ZOOM_STEP).toBeDefined();
  });
});
