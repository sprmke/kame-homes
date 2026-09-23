import { describe, expect, it } from 'vitest';

import { buildDefaultVideoProject, parseVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';

describe('buildDefaultVideoProject', () => {

  it('buildDefaultVideoProject is exported', () => {
    expect(typeof buildDefaultVideoProject).toBe('function');
  });

});

describe('parseVideoProject', () => {

  it('parseVideoProject is exported', () => {
    expect(typeof parseVideoProject).toBe('function');
  });

});
