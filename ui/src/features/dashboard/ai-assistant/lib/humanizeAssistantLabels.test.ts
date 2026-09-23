import { describe, expect, it } from 'vitest';

import { collectHostLabelsFromBlocks, isTechnicalBookingChip, humanizeAssistantQuickActions } from '@/features/dashboard/ai-assistant/lib/humanizeAssistantLabels';

describe('collectHostLabelsFromBlocks', () => {

  it('collectHostLabelsFromBlocks is exported', () => {
    expect(typeof collectHostLabelsFromBlocks).toBe('function');
  });

});

describe('isTechnicalBookingChip', () => {

  it('isTechnicalBookingChip is exported', () => {
    expect(typeof isTechnicalBookingChip).toBe('function');
  });

});

describe('humanizeAssistantQuickActions', () => {

  it('humanizeAssistantQuickActions is exported', () => {
    expect(typeof humanizeAssistantQuickActions).toBe('function');
  });

});
