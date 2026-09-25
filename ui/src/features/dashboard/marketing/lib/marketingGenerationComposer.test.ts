import { describe, expect, it } from 'vitest';

import {
  composerValuesFromJob,
  fileNameForGeneratedReference,
  referencesMatchingJob,
} from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import type {
  MarketingGenerationJob,
  MarketingGenerationReference,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

const library: MarketingGenerationReference[] = [
  {
    id: 'ref-1',
    organization_id: 'org-1',
    property_id: 'prop-1',
    media_type: 'image',
    storage_path: 'marketing-ai-refs/prop-1/a.jpg',
    public_url: 'https://cdn.example/a.jpg',
    mime_type: 'image/jpeg',
    file_name: 'a.jpg',
    byte_size: 100,
    width: 800,
    height: 800,
    duration_seconds: null,
    last_used_at: null,
    created_at: '2026-09-12T08:00:00.000Z',
  },
  {
    id: 'ref-2',
    organization_id: 'org-1',
    property_id: 'prop-1',
    media_type: 'image',
    storage_path: 'marketing-ai-refs/prop-1/b.jpg',
    public_url: 'https://cdn.example/b.jpg',
    mime_type: 'image/jpeg',
    file_name: 'b.jpg',
    byte_size: 100,
    width: 800,
    height: 800,
    duration_seconds: null,
    last_used_at: null,
    created_at: '2026-09-12T08:00:00.000Z',
  },
];

function job(overrides: Partial<MarketingGenerationJob> = {}): MarketingGenerationJob {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    propertyId: 'prop-1',
    mediaType: 'image',
    jobStatus: 'completed',
    prompt: 'Balcony at dusk',
    negativePrompt: null,
    enhancedPrompt: null,
    promptEnhanced: false,
    model: 'gemini-3.1-flash-image',
    qualityTier: 'standard',
    aspectRatio: '4:5',
    imageSize: '2K',
    resolution: null,
    durationSeconds: null,
    referenceUrls: ['https://cdn.example/a.jpg'],
    referencePaths: ['marketing-ai-refs/prop-1/a.jpg'],
    outputUrl: 'https://cdn.example/out.png',
    outputMimeType: 'image/png',
    outputBytes: 1000,
    outputWidth: 1024,
    outputHeight: 1280,
    estimatedCredits: 151,
    creditsConsumed: 151,
    errorCode: null,
    errorMessage: null,
    expiresAt: null,
    completedAt: '2026-09-12T08:00:00.000Z',
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    ...overrides,
  };
}

describe('referencesMatchingJob', () => {
  it('matches library rows by path or url', () => {
    expect(referencesMatchingJob(job(), library).map((row) => row.id)).toEqual(['ref-1']);
    expect(
      referencesMatchingJob(
        job({ referencePaths: [], referenceUrls: ['https://cdn.example/b.jpg'] }),
        library
      ).map((row) => row.id)
    ).toEqual(['ref-2']);
  });

  it('returns empty when the job has no references', () => {
    expect(referencesMatchingJob(job({ referencePaths: [], referenceUrls: [] }), library)).toEqual(
      []
    );
  });
});

describe('composerValuesFromJob', () => {
  it('restores image settings and matched photos', () => {
    const values = composerValuesFromJob(job(), library, {
      allowPremium: false,
      allowHighResolution: true,
    });
    expect(values.mediaType).toBe('image');
    expect(values.prompt).toBe('Balcony at dusk');
    expect(values.qualityTier).toBe('standard');
    expect(values.aspectRatio).toBe('4:5');
    expect(values.imageSize).toBe('2K');
    expect(values.references.map((row) => row.id)).toEqual(['ref-1']);
  });

  it('falls premium back to standard when the hatch is off', () => {
    const values = composerValuesFromJob(job({ qualityTier: 'premium' }), library, {
      allowPremium: false,
      allowHighResolution: false,
    });
    expect(values.qualityTier).toBe('standard');
  });

  it('falls 1080p back to 720p when high resolution is off', () => {
    const values = composerValuesFromJob(
      job({
        mediaType: 'video',
        aspectRatio: '9:16',
        resolution: '1080p',
        durationSeconds: 6,
      }),
      library,
      { allowPremium: true, allowHighResolution: false }
    );
    expect(values.mediaType).toBe('video');
    expect(values.resolution).toBe('720p');
    expect(values.durationSeconds).toBe(6);
    expect(values.aspectRatio).toBe('9:16');
  });

  it('locks draft image size to 1K', () => {
    const values = composerValuesFromJob(job({ qualityTier: 'draft', imageSize: '4K' }), library, {
      allowPremium: true,
      allowHighResolution: true,
    });
    expect(values.imageSize).toBe('1K');
  });
});

describe('fileNameForGeneratedReference', () => {
  it('uses png when the mime says png', () => {
    expect(fileNameForGeneratedReference({ id: 'abc', outputMimeType: 'image/png' })).toBe(
      'generated-abc.png'
    );
  });
});
