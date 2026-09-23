import { describe, expect, it } from 'vitest';

import { partitionAssistantBlocks } from '@/features/dashboard/ai-assistant/lib/partitionAssistantBlocks';

describe('partitionAssistantBlocks', () => {

  it('partitionAssistantBlocks is exported', () => {
    expect(typeof partitionAssistantBlocks).toBe('function');
  });

});
