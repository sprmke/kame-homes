import { describe, expect, it } from 'vitest';

import { refetchIntervalWhenVisibleMs } from '@/lib/query/refetchWhenVisible';

describe('refetchIntervalWhenVisibleMs', () => {

  it('refetchIntervalWhenVisibleMs is exported', () => {
    expect(typeof refetchIntervalWhenVisibleMs).toBe('function');
  });

});
