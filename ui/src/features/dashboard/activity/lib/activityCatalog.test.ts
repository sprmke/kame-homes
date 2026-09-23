import { describe, expect, it } from 'vitest';

import { activityCategoryIcon, activityCategoryLabel, activityActorLabel } from '@/features/dashboard/activity/lib/activityCatalog';

describe('activityCategoryIcon', () => {

  it('activityCategoryIcon is exported', () => {
    expect(typeof activityCategoryIcon).toBe('function');
  });

});

describe('activityCategoryLabel', () => {

  it('activityCategoryLabel is exported', () => {
    expect(typeof activityCategoryLabel).toBe('function');
  });

});

describe('activityActorLabel', () => {

  it('activityActorLabel is exported', () => {
    expect(typeof activityActorLabel).toBe('function');
  });

});
