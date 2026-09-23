import { describe, expect, it } from 'vitest';

import { getAssistantToolAuditLabel, getAssistantToolActivityLabel } from '@/features/dashboard/ai-assistant/lib/assistantToolLabels';

describe('getAssistantToolAuditLabel', () => {

  it('getAssistantToolAuditLabel is exported', () => {
    expect(typeof getAssistantToolAuditLabel).toBe('function');
  });

});

describe('getAssistantToolActivityLabel', () => {

  it('getAssistantToolActivityLabel is exported', () => {
    expect(typeof getAssistantToolActivityLabel).toBe('function');
  });

});
