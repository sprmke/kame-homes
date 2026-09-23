import { describe, expect, it } from 'vitest';

import { focusComposerInput } from '@/lib/chat/focusComposerInput';

describe('focusComposerInput', () => {

  it('focusComposerInput is exported', () => {
    expect(typeof focusComposerInput).toBe('function');
  });

});
