import { describe, expect, it } from 'vitest';

import { friendlyToastError, isTechnicalToastMessage, sanitizeToastMessage } from './toastMessages';

const GEMINI_QUOTA_DUMP = `You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-flash-image * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image Please retry in 24.474649167s.`;

describe('sanitizeToastMessage', () => {
  it('replaces a Gemini quota dump with a short host line', () => {
    expect(sanitizeToastMessage(GEMINI_QUOTA_DUMP)).toBe(
      'This is busy right now. Try again in a moment.'
    );
  });

  it('keeps short host-authored copy', () => {
    expect(sanitizeToastMessage('Could not save settings')).toBe('Could not save settings');
    expect(sanitizeToastMessage('AI usage limit reached')).toBe('AI usage limit reached');
    expect(
      sanitizeToastMessage(
        'This would use more AI credits than your plan has left this month. Top up credits or upgrade to continue.'
      )
    ).toBe(
      'This would use more AI credits than your plan has left this month. Top up credits or upgrade to continue.'
    );
  });

  it('maps session, network, and permission failures', () => {
    expect(sanitizeToastMessage('No active session')).toBe('Please sign in again');
    expect(sanitizeToastMessage('Failed to fetch')).toBe('Network error. Check your connection');
    expect(sanitizeToastMessage('You do not have permission to edit this')).toBe(
      'You do not have permission to do that'
    );
  });

  it('does not treat a Telegram unauthorized dump as a permission toast', () => {
    expect(sanitizeToastMessage('Unauthorized: invalid token')).toBe(
      'Something went wrong. Try again.'
    );
  });

  it('maps missing provider config without naming the provider', () => {
    expect(sanitizeToastMessage('Image generation is not configured')).toBe(
      'This is temporarily unavailable.'
    );
  });

  it('uses the fallback for empty input', () => {
    expect(sanitizeToastMessage('', 'Could not generate that. Try again.')).toBe(
      'Could not generate that. Try again.'
    );
  });
});

describe('isTechnicalToastMessage', () => {
  it('flags URLs, model ids, and HTTP jargon', () => {
    expect(isTechnicalToastMessage(GEMINI_QUOTA_DUMP)).toBe(true);
    expect(isTechnicalToastMessage('Image generation failed (502)')).toBe(true);
    expect(isTechnicalToastMessage('gemini-3.1-flash-image quota')).toBe(true);
    expect(isTechnicalToastMessage('Could not save settings')).toBe(false);
  });
});

describe('friendlyToastError', () => {
  it('accepts Error and string values', () => {
    expect(friendlyToastError(new Error(GEMINI_QUOTA_DUMP))).toBe(
      'This is busy right now. Try again in a moment.'
    );
    expect(friendlyToastError('Saved')).toBe('Saved');
    expect(friendlyToastError(null, 'Could not send')).toBe('Could not send');
  });
});
