import { describe, expect, it } from 'vitest';

import { extractLeadingSectionHeading } from '@/features/guest/stay-guide/lib/stayGuideContent';

describe('extractLeadingSectionHeading', () => {

  it('extractLeadingSectionHeading is exported', () => {
    expect(typeof extractLeadingSectionHeading).toBe('function');
  });

});
