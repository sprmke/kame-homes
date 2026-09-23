import { describe, expect, it } from 'vitest';

import { normalizeHex, normalizeDesignTemplateTokens, isDesignAiHex } from '@/features/dashboard/marketing/lib/designAiTokens';

describe('normalizeHex', () => {

  it('normalizeHex is exported', () => {
    expect(typeof normalizeHex).toBe('function');
  });

});

describe('normalizeDesignTemplateTokens', () => {

  it('normalizeDesignTemplateTokens is exported', () => {
    expect(typeof normalizeDesignTemplateTokens).toBe('function');
  });

});

describe('isDesignAiHex', () => {

  it('isDesignAiHex is exported', () => {
    expect(typeof isDesignAiHex).toBe('function');
  });

});
