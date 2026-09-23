import { describe, expect, it } from 'vitest';

import { isReviewVideoTemplate, applyGuestReviewToVideoProject } from '@/features/dashboard/marketing/lib/video/applyGuestReviewToVideoProject';

describe('isReviewVideoTemplate', () => {

  it('isReviewVideoTemplate is exported', () => {
    expect(typeof isReviewVideoTemplate).toBe('function');
  });

});

describe('applyGuestReviewToVideoProject', () => {

  it('applyGuestReviewToVideoProject is exported', () => {
    expect(typeof applyGuestReviewToVideoProject).toBe('function');
  });

});
