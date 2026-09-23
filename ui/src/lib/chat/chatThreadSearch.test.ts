import { describe, expect, it } from 'vitest';

import { findThreadSearchMatches } from '@/lib/chat/chatThreadSearch';

describe('findThreadSearchMatches', () => {

  it('findThreadSearchMatches is exported', () => {
    expect(typeof findThreadSearchMatches).toBe('function');
  });

});
