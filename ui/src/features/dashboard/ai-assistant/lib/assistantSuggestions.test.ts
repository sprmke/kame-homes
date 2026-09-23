import { describe, expect, it } from 'vitest';

import { SUGGESTION_VISIBLE_COUNT } from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';

describe('SUGGESTION_VISIBLE_COUNT', () => {
  it('is defined', () => {
    expect(SUGGESTION_VISIBLE_COUNT).toBeDefined();
  });
});
