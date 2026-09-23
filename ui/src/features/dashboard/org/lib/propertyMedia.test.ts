import { describe, expect, it } from 'vitest';

import { classifyPropertyMediaFile, maxBytesForPropertyMediaKind, formatPropertyMediaSizeLimit, validatePropertyMediaFile, countPropertyMedia, sequencedPropertyMediaItems, partitionPropertyMedia, MAX_PROPERTY_IMAGES, MAX_PROPERTY_VIDEOS, MAX_PROPERTY_IMAGE_BYTES, MAX_PROPERTY_VIDEO_BYTES, ACCEPT_PROPERTY_IMAGE_INPUT, ACCEPT_PROPERTY_VIDEO_INPUT } from '@/features/dashboard/org/lib/propertyMedia';

describe('classifyPropertyMediaFile', () => {

  it('classifyPropertyMediaFile is exported', () => {
    expect(typeof classifyPropertyMediaFile).toBe('function');
  });

});

describe('maxBytesForPropertyMediaKind', () => {

  it('maxBytesForPropertyMediaKind is exported', () => {
    expect(typeof maxBytesForPropertyMediaKind).toBe('function');
  });

});

describe('formatPropertyMediaSizeLimit', () => {

  it('formatPropertyMediaSizeLimit is exported', () => {
    expect(typeof formatPropertyMediaSizeLimit).toBe('function');
  });

});

describe('validatePropertyMediaFile', () => {

  it('validatePropertyMediaFile is exported', () => {
    expect(typeof validatePropertyMediaFile).toBe('function');
  });

});

describe('countPropertyMedia', () => {

  it('countPropertyMedia is exported', () => {
    expect(typeof countPropertyMedia).toBe('function');
  });

});

describe('sequencedPropertyMediaItems', () => {

  it('sequencedPropertyMediaItems is exported', () => {
    expect(typeof sequencedPropertyMediaItems).toBe('function');
  });

});

describe('partitionPropertyMedia', () => {

  it('partitionPropertyMedia is exported', () => {
    expect(typeof partitionPropertyMedia).toBe('function');
  });

});

describe('MAX_PROPERTY_IMAGES', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_IMAGES).toBeDefined();
  });
});

describe('MAX_PROPERTY_VIDEOS', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_VIDEOS).toBeDefined();
  });
});

describe('MAX_PROPERTY_IMAGE_BYTES', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_IMAGE_BYTES).toBeDefined();
  });
});

describe('MAX_PROPERTY_VIDEO_BYTES', () => {
  it('is defined', () => {
    expect(MAX_PROPERTY_VIDEO_BYTES).toBeDefined();
  });
});

describe('ACCEPT_PROPERTY_IMAGE_INPUT', () => {
  it('is defined', () => {
    expect(ACCEPT_PROPERTY_IMAGE_INPUT).toBeDefined();
  });
});

describe('ACCEPT_PROPERTY_VIDEO_INPUT', () => {
  it('is defined', () => {
    expect(ACCEPT_PROPERTY_VIDEO_INPUT).toBeDefined();
  });
});
