import { describe, expect, it } from 'vitest';

import { textsForStoryboardBeats, mergeSceneTextsForKind } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';

describe('textsForStoryboardBeats', () => {

  it('textsForStoryboardBeats is exported', () => {
    expect(typeof textsForStoryboardBeats).toBe('function');
  });

});

describe('mergeSceneTextsForKind', () => {

  it('mergeSceneTextsForKind is exported', () => {
    expect(typeof mergeSceneTextsForKind).toBe('function');
  });

});
