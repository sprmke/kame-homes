import { describe, expect, it } from 'vitest';

import { shouldPromptAssistantUpgrade } from '@/features/dashboard/ai-assistant/lib/assistantAccess';

describe('shouldPromptAssistantUpgrade', () => {
  it('does not open while access is still loading', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: true,
        permissionAllowed: true,
        accessible: false,
      })
    ).toBe(false);
  });

  it('does not open when the member lacks assistant:view', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: false,
        accessible: false,
      })
    ).toBe(false);
  });

  it('opens when the plan or kill switch blocks a permitted member', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: true,
        accessible: false,
      })
    ).toBe(true);
  });

  it('does not open when the assistant is usable', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: true,
        accessible: true,
      })
    ).toBe(false);
  });
});
