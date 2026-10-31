import { describe, expect, it } from 'vitest';

import { resolveAssistantAiOffReason } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';

describe('resolveAssistantAiOffReason', () => {
  it('is null when nothing is off', () => {
    expect(resolveAssistantAiOffReason(null, null)).toBeNull();
    expect(resolveAssistantAiOffReason(undefined, null)).toBeNull();
  });

  it('never offers the Settings card for a platform block', () => {
    expect(resolveAssistantAiOffReason('platform', null)).toBeNull();
    expect(resolveAssistantAiOffReason('platform', 'platform')).toBeNull();
    expect(resolveAssistantAiOffReason(undefined, 'platform')).toBeNull();
    expect(resolveAssistantAiOffReason(null, 'platform')).toBeNull();
  });

  it('shows the card when the org switch is off', () => {
    expect(resolveAssistantAiOffReason('organization', null)).toBe('organization');
    expect(resolveAssistantAiOffReason(undefined, 'organization')).toBe('organization');
  });

  it('clears a stale org block once settings say AI is on', () => {
    expect(resolveAssistantAiOffReason(null, 'organization')).toBeNull();
  });

  it('trusts the turn for a property block', () => {
    expect(resolveAssistantAiOffReason(null, 'property')).toBe('property');
    expect(resolveAssistantAiOffReason(undefined, 'property')).toBe('property');
  });
});
