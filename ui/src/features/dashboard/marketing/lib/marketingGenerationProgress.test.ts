import { describe, expect, it } from 'vitest';

import { generationErrorMessage } from './marketingGenerationProgress';

import type { MarketingGenerationJob } from './marketingGenerationTypes';

function job(overrides: Partial<MarketingGenerationJob>): MarketingGenerationJob {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    propertyId: 'prop-1',
    mediaType: 'image',
    jobStatus: 'failed',
    prompt: 'sunset patio',
    negativePrompt: null,
    model: 'gemini-3.1-flash-image',
    qualityTier: 'standard',
    aspectRatio: '1:1',
    imageSize: '1K',
    resolution: null,
    durationSeconds: null,
    referenceUrls: [],
    referencePaths: [],
    outputUrl: null,
    outputMimeType: null,
    outputBytes: null,
    outputWidth: null,
    outputHeight: null,
    estimatedCredits: 45,
    creditsConsumed: null,
    errorCode: null,
    errorMessage: null,
    expiresAt: null,
    completedAt: null,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('generationErrorMessage', () => {
  it('uses short copy for known error codes', () => {
    expect(generationErrorMessage(job({ errorCode: 'safety_blocked' }))).toBe(
      'That prompt was blocked. Try rephrasing.'
    );
    expect(generationErrorMessage(job({ errorCode: 'timeout' }))).toBe(
      'This took too long and was stopped. You were not charged.'
    );
  });

  it('never surfaces a stored Gemini quota dump on the card', () => {
    expect(
      generationErrorMessage(
        job({
          errorCode: 'provider_error',
          errorMessage:
            'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, model: gemini-3.1-flash-image',
        })
      )
    ).toBe('This is busy right now. Try again in a moment.');
  });
});

