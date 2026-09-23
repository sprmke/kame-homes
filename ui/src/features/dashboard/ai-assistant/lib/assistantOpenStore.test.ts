import { describe, expect, it } from 'vitest';

import { openAiAssistant, subscribeAssistantOpenRequest, getAssistantOpenRequestId } from '@/features/dashboard/ai-assistant/lib/assistantOpenStore';

describe('openAiAssistant', () => {

  it('openAiAssistant is exported', () => {
    expect(typeof openAiAssistant).toBe('function');
  });

});

describe('subscribeAssistantOpenRequest', () => {

  it('subscribeAssistantOpenRequest is exported', () => {
    expect(typeof subscribeAssistantOpenRequest).toBe('function');
  });

});

describe('getAssistantOpenRequestId', () => {

  it('getAssistantOpenRequestId is exported', () => {
    expect(typeof getAssistantOpenRequestId).toBe('function');
  });

});
