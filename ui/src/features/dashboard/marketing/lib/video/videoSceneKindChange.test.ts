import { describe, expect, it } from 'vitest';

import { videoTemplateFieldsToSceneTexts, applySceneKindChange } from '@/features/dashboard/marketing/lib/video/videoSceneKindChange';

describe('videoTemplateFieldsToSceneTexts', () => {

  it('videoTemplateFieldsToSceneTexts is exported', () => {
    expect(typeof videoTemplateFieldsToSceneTexts).toBe('function');
  });

});

describe('applySceneKindChange', () => {

  it('applySceneKindChange is exported', () => {
    expect(typeof applySceneKindChange).toBe('function');
  });

});
