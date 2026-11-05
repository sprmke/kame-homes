import { describe, expect, it } from 'vitest';

import {
  buildAiTurns,
  flattenVersions,
  isVersionInFlight,
  isVersionUsable,
  latestVersion,
  versionAspect,
  versionThumbUrl,
  type AiPostVersionRecord,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  GENERATION_LOOKS,
  composeGenerationPrompt,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

function job(overrides: Partial<MarketingGenerationJob>): MarketingGenerationJob {
  return {
    id: 'j1',
    organizationId: 'o',
    propertyId: 'p',
    mediaType: 'image',
    jobStatus: 'completed',
    prompt: 'Balcony at golden hour',
    negativePrompt: null,
    enhancedPrompt: null,
    promptEnhanced: false,
    model: 'm',
    qualityTier: 'standard',
    aspectRatio: '4:5',
    imageSize: '1K',
    resolution: null,
    durationSeconds: null,
    referenceUrls: [],
    referencePaths: [],
    outputUrl: 'https://cdn/out.jpg',
    outputMimeType: 'image/jpeg',
    outputBytes: 1,
    outputWidth: 1,
    outputHeight: 1,
    estimatedCredits: 35,
    creditsConsumed: 35,
    errorCode: null,
    errorMessage: null,
    expiresAt: null,
    completedAt: null,
    createdAt: '2026-10-20T01:00:00Z',
    updatedAt: '2026-10-20T01:00:00Z',
    ...overrides,
  };
}

function post(overrides: Partial<AiPostVersionRecord>): AiPostVersionRecord {
  return {
    id: 'v1',
    sessionId: 's',
    turnId: 't1',
    prompt: 'Weekday stays',
    goal: 'promo',
    format: 'instagram-portrait',
    spec: {},
    photoUrls: [],
    previewUrl: 'https://cdn/v1.jpg',
    parentVersionId: null,
    createdAt: '2026-10-20T01:00:00Z',
    ...overrides,
  };
}

describe('buildAiTurns', () => {
  it('makes one turn per photo job, oldest first, numbered across the thread', () => {
    const turns = buildAiTurns({
      jobs: [
        job({
          id: 'a',
          prompt: composeGenerationPrompt('Balcony at golden hour', GENERATION_LOOKS[0]!.id),
        }),
        job({ id: 'b', prompt: 'Make it evening', createdAt: '2026-10-20T02:00:00Z' }),
      ],
      postVersions: [],
    });
    expect(turns.map((turn) => turn.prompt)).toEqual(['Balcony at golden hour', 'Make it evening']);
    expect(flattenVersions(turns).map((version) => version.number)).toEqual([1, 2]);
    expect(latestVersion(turns)?.key).toBe('image:b');
  });

  it('groups post versions by message and labels messages without words', () => {
    const turns = buildAiTurns({
      jobs: [],
      postVersions: [
        post({ id: 'a1' }),
        post({ id: 'a2' }),
        post({ id: 'a3' }),
        post({ id: 'a4' }),
        post({
          id: 'b1',
          turnId: 't2',
          prompt: null,
          parentVersionId: 'a2',
          createdAt: '2026-10-20T02:00:00Z',
        }),
        post({
          id: 'c1',
          turnId: 't3',
          prompt: null,
          parentVersionId: 'b1',
          format: 'instagram-story',
          createdAt: '2026-10-20T03:00:00Z',
        }),
      ],
    });
    expect(turns).toHaveLength(3);
    expect(turns[0]!.versions).toHaveLength(4);
    expect(turns[1]!.note).toBe('New layout');
    expect(turns[2]!.note).toBe('Resized to Story');
    expect(latestVersion(turns)?.number).toBe(6);
  });

  it('names a first post made without words by its goal', () => {
    const turns = buildAiTurns({ jobs: [], postVersions: [post({ prompt: null })] });
    expect(turns[0]!.note).toBe('Promo post');
  });

  it('drops the server default prompt of a clip started from a photo', () => {
    const turns = buildAiTurns({
      jobs: [job({ mediaType: 'video', prompt: 'Bring this photo to life' })],
      postVersions: [],
    });
    expect(turns[0]!.prompt).toBeNull();
  });
});

describe('version helpers', () => {
  it('knows which versions can be shown and shared', () => {
    const [done] = flattenVersions(buildAiTurns({ jobs: [job({})], postVersions: [] }));
    const [rendering] = flattenVersions(
      buildAiTurns({
        jobs: [job({ mediaType: 'video', jobStatus: 'processing', outputUrl: null })],
        postVersions: [],
      })
    );
    expect(isVersionUsable(done)).toBe(true);
    expect(isVersionInFlight(rendering)).toBe(true);
    expect(isVersionUsable(rendering)).toBe(false);
  });

  it('uses the start photo for a clip thumbnail and the job ratio for its frame', () => {
    const [clip] = flattenVersions(
      buildAiTurns({
        jobs: [
          job({
            mediaType: 'video',
            aspectRatio: '9:16',
            referenceUrls: ['https://cdn/start.jpg'],
            outputUrl: 'https://cdn/clip.mp4',
          }),
        ],
        postVersions: [],
      })
    );
    expect(versionThumbUrl(clip!)).toBe('https://cdn/start.jpg');
    expect(versionAspect(clip!)).toBe('9 / 16');
  });
});
