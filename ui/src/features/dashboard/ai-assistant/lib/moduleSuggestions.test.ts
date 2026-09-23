import { describe, expect, it } from 'vitest';

import { selectContextualSuggestions } from '@/features/dashboard/ai-assistant/lib/moduleSuggestions';

describe('selectContextualSuggestions', () => {

  it('selectContextualSuggestions is exported', () => {
    expect(typeof selectContextualSuggestions).toBe('function');
  });

});
