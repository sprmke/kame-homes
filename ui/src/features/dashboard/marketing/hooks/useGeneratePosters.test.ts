import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generatePosters } from '@/features/dashboard/marketing/hooks/useGeneratePosters';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { AiQuotaExceededClientError } from '@/features/dashboard/org/lib/aiQuotaToast';

vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  getSessionJwt: vi.fn(async () => 'jwt'),
}));
vi.mock('@/features/dashboard/org/lib/adminApiScope', () => ({
  scopedFunctionsUrl: (name: string, propertyId: string | null) =>
    `https://edge.test/${name}?property_id=${propertyId}`,
  usePropertyIdParam: () => 'prop-1',
}));

const FACTS = buildPosterFacts({
  propertyName: 'Kame Home',
  property: {
    amenities: ['WiFi', 'Swimming Pool'],
    residenceName: 'Azure North',
    state: 'Pampanga',
  },
  photos: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg', 'https://cdn.test/c.jpg'],
});

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('generatePosters', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the poster payload and remaps photos to what the director actually saw', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(200, {
        success: true,
        data: {
          contentType: 'poster',
          photoUrls: ['https://cdn.test/c.jpg'],
          variants: [{ archetype: 'minimal-title', copy: { headline: 'Slow' }, photoIndexes: [0] }],
        },
      })
    );

    const result = await generatePosters('prop-1', {
      goal: 'vibe',
      prompt: 'coffee',
      facts: FACTS,
      brandColor: '#b86a2c',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://edge.test/generate-marketing-template?property_id=prop-1');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ contentType: 'poster', goal: 'vibe', prompt: 'coffee', count: 4 });
    expect(body.photoUrls).toEqual(FACTS.photos);
    expect(body.facts).not.toHaveProperty('photos');

    expect(result.aiDirected).toBe(true);
    expect(result.facts.photos).toEqual(['https://cdn.test/c.jpg']);
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]).toMatchObject({ archetype: 'minimal-title', photoIndexes: [0] });
  });

  it('falls back to rule-based posters when the director fails', async () => {
    fetchMock.mockResolvedValueOnce(respond(503, { success: false, error: 'busy' }));

    const result = await generatePosters('prop-1', {
      goal: 'promo',
      prompt: '',
      facts: FACTS,
      brandColor: null,
    });

    expect(result.aiDirected).toBe(false);
    expect(result.specs).toHaveLength(4);
    expect(new Set(result.specs.map((spec) => spec.archetype)).size).toBe(4);
    expect(result.facts).toBe(FACTS);
  });

  it('falls back when the director returns no usable variants', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(200, { success: true, data: { contentType: 'poster', photoUrls: [], variants: [] } })
    );
    const result = await generatePosters('prop-1', {
      goal: 'vibe',
      prompt: '',
      facts: FACTS,
      brandColor: null,
    });
    expect(result.aiDirected).toBe(false);
    expect(result.specs.length).toBeGreaterThan(0);
  });

  it('rethrows quota errors so the host sees the upgrade prompt instead of free layouts', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(429, { success: false, error: 'Out of AI credits', upgradeHook: true })
    );
    await expect(
      generatePosters('prop-1', { goal: 'vibe', prompt: '', facts: FACTS, brandColor: null })
    ).rejects.toBeInstanceOf(AiQuotaExceededClientError);
  });

  it('falls back on a malformed success payload', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { success: true, data: {} }));
    const result = await generatePosters('prop-1', {
      goal: 'vibe',
      prompt: '',
      facts: FACTS,
      brandColor: null,
    });
    expect(result.aiDirected).toBe(false);
    expect(result.facts).toBe(FACTS);
  });

  it('falls back on a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await generatePosters('prop-1', {
      goal: 'stay-info',
      prompt: '',
      facts: FACTS,
      brandColor: null,
    });
    expect(result.aiDirected).toBe(false);
  });
});
