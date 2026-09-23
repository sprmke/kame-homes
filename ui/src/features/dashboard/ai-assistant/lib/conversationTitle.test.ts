import { describe, expect, it } from 'vitest';

import { displayConversationTitle } from '@/features/dashboard/ai-assistant/lib/conversationTitle';

describe('displayConversationTitle', () => {

  it('displayConversationTitle is exported', () => {
    expect(typeof displayConversationTitle).toBe('function');
  });

});
