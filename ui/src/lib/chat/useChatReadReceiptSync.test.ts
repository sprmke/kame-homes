import { describe, expect, it } from 'vitest';

import { useChatReadReceiptSync } from '@/lib/chat/useChatReadReceiptSync';

describe('useChatReadReceiptSync', () => {

  it('useChatReadReceiptSync is exported', () => {
    expect(typeof useChatReadReceiptSync).toBe('function');
  });

});
