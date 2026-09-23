import { describe, expect, it } from 'vitest';

import { isJamendoStreamUrl, videoMusicFromJamendoTrack, findJamendoTrackForMusic, applyImportedVideoMusic } from '@/features/dashboard/marketing/lib/video/importVideoMusic';

describe('isJamendoStreamUrl', () => {

  it('isJamendoStreamUrl is exported', () => {
    expect(typeof isJamendoStreamUrl).toBe('function');
  });

});

describe('videoMusicFromJamendoTrack', () => {

  it('videoMusicFromJamendoTrack is exported', () => {
    expect(typeof videoMusicFromJamendoTrack).toBe('function');
  });

});

describe('findJamendoTrackForMusic', () => {

  it('findJamendoTrackForMusic is exported', () => {
    expect(typeof findJamendoTrackForMusic).toBe('function');
  });

});

describe('applyImportedVideoMusic', () => {

  it('applyImportedVideoMusic is exported', () => {
    expect(typeof applyImportedVideoMusic).toBe('function');
  });

});
