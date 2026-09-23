import { describe, expect, it } from 'vitest';

import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';

describe('useChatThreadSearch', () => {

  it('useChatThreadSearch is exported', () => {
    expect(typeof useChatThreadSearch).toBe('function');
  });

});
