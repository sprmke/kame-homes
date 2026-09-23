import { describe, expect, it } from 'vitest';

import { useChatTyping } from '@/lib/chat/useChatTyping';

describe('useChatTyping', () => {

  it('useChatTyping is exported', () => {
    expect(typeof useChatTyping).toBe('function');
  });

});
