import { describe, expect, it } from 'vitest';

import { isAiAssistantFabVisible, AI_ASSISTANT_FAB_SIZE_PX, AI_ASSISTANT_FAB_STACK_GAP_PX, notificationFabStackedBottomClassName } from '@/features/dashboard/ai-assistant/lib/assistantFabLayout';

describe('isAiAssistantFabVisible', () => {

  it('isAiAssistantFabVisible is exported', () => {
    expect(typeof isAiAssistantFabVisible).toBe('function');
  });

});

describe('AI_ASSISTANT_FAB_SIZE_PX', () => {
  it('is defined', () => {
    expect(AI_ASSISTANT_FAB_SIZE_PX).toBeDefined();
  });
});

describe('AI_ASSISTANT_FAB_STACK_GAP_PX', () => {
  it('is defined', () => {
    expect(AI_ASSISTANT_FAB_STACK_GAP_PX).toBeDefined();
  });
});

describe('notificationFabStackedBottomClassName', () => {
  it('is defined', () => {
    expect(notificationFabStackedBottomClassName).toBeDefined();
  });
});
