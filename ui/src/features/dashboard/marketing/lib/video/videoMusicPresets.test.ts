import { describe, expect, it } from 'vitest';

import { matchDefaultJamendoTrack, needsVideoMusicResolution, needsVideoMusicPlayback, needsVideoMusicStorageCache, isDefaultVideoMusicPending, defaultProjectMusic, VIDEO_MUSIC_CLEARED_TRACK_ID } from '@/features/dashboard/marketing/lib/video/videoMusicPresets';

describe('matchDefaultJamendoTrack', () => {

  it('matchDefaultJamendoTrack is exported', () => {
    expect(typeof matchDefaultJamendoTrack).toBe('function');
  });

});

describe('needsVideoMusicResolution', () => {

  it('needsVideoMusicResolution is exported', () => {
    expect(typeof needsVideoMusicResolution).toBe('function');
  });

});

describe('needsVideoMusicPlayback', () => {

  it('needsVideoMusicPlayback is exported', () => {
    expect(typeof needsVideoMusicPlayback).toBe('function');
  });

});

describe('needsVideoMusicStorageCache', () => {

  it('needsVideoMusicStorageCache is exported', () => {
    expect(typeof needsVideoMusicStorageCache).toBe('function');
  });

});

describe('isDefaultVideoMusicPending', () => {

  it('isDefaultVideoMusicPending is exported', () => {
    expect(typeof isDefaultVideoMusicPending).toBe('function');
  });

});

describe('defaultProjectMusic', () => {

  it('defaultProjectMusic is exported', () => {
    expect(typeof defaultProjectMusic).toBe('function');
  });

});

describe('VIDEO_MUSIC_CLEARED_TRACK_ID', () => {
  it('is defined', () => {
    expect(VIDEO_MUSIC_CLEARED_TRACK_ID).toBeDefined();
  });
});
