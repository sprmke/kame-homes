import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/chat/chatMessageCache';

describe('chatMessageCache', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
