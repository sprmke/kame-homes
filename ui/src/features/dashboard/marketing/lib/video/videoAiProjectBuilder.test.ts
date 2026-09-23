import { describe, expect, it } from 'vitest';

import { resolveAiGeneratedVideoProject, resolveAiGeneratedVideoProjectsForAllFormats } from '@/features/dashboard/marketing/lib/video/videoAiProjectBuilder';

describe('resolveAiGeneratedVideoProject', () => {

  it('resolveAiGeneratedVideoProject is exported', () => {
    expect(typeof resolveAiGeneratedVideoProject).toBe('function');
  });

});

describe('resolveAiGeneratedVideoProjectsForAllFormats', () => {

  it('resolveAiGeneratedVideoProjectsForAllFormats is exported', () => {
    expect(typeof resolveAiGeneratedVideoProjectsForAllFormats).toBe('function');
  });

});
