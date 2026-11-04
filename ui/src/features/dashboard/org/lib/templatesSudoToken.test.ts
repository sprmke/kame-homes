import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTemplatesSudoToken,
  isTemplatesVerificationError,
  PROPERTY_TEMPLATES_SUDO_FINGERPRINT,
  readTemplatesSudoToken,
  storeTemplatesSudoToken,
} from '@/features/dashboard/org/lib/templatesSudoToken';

describe('templatesSudoToken', () => {
  afterEach(() => {
    clearTemplatesSudoToken('prop-1');
  });

  it('exports the stable sudo fingerprint', () => {
    expect(PROPERTY_TEMPLATES_SUDO_FINGERPRINT).toBe('property_templates');
  });

  it('stores and reads a token until expiry', () => {
    storeTemplatesSudoToken('prop-1', 'tok-abc', Date.now() + 60_000);
    expect(readTemplatesSudoToken('prop-1')).toBe('tok-abc');
  });

  it('clears expired tokens on read', () => {
    storeTemplatesSudoToken('prop-1', 'tok-old', Date.now() - 1);
    expect(readTemplatesSudoToken('prop-1')).toBeNull();
  });

  it('detects verification errors from the edge gate', () => {
    expect(isTemplatesVerificationError(new Error('Invalid or expired verification token'))).toBe(
      true
    );
    expect(isTemplatesVerificationError(new Error('Failed to save template'))).toBe(false);
  });
});
