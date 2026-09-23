import { describe, expect, it } from 'vitest';

import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';

describe('scrollToSection', () => {

  it('scrollToSection is exported', () => {
    expect(typeof scrollToSection).toBe('function');
  });

});
