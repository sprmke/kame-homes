import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAiCreateRequest } from '@/features/dashboard/marketing/lib/aiStudioCreatePayload';
import { POST_FORMATS } from '@/features/dashboard/marketing/lib/aiStudioPostOptions';
import { READY_SAMPLE_IDS } from '@/features/dashboard/marketing/lib/aiStudioSampleAssets';
import {
  AI_STUDIO_SAMPLES,
  CLIP_SAMPLES,
  PHOTO_SAMPLES,
  POST_SAMPLES,
  SHOWCASE_PHOTOS,
  findSample,
  isSampleIdShape,
  listSamples,
  orderPosterBatch,
  postSampleAvailable,
  postSampleCacheKey,
  postSampleFacts,
  sampleCredits,
  sampleFilePaths,
  samplePrompt,
  samplePromptLimit,
  sampleResolution,
  sampleToCreateState,
  showcaseFacts,
  showcasePhotoPaths,
  sourceImage,
  type AiStudioSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';
import {
  DEFAULT_VIDEO_CAMERA_MOVE,
  DEFAULT_VIDEO_SOUND,
  GENERATION_LOOKS,
  IMAGE_ASPECT_RATIO_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_CAMERA_MOVES,
  VIDEO_SOUND_MODES,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import { estimateGenerationCredits } from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import { POSTER_GOAL_ARCHETYPES } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const PUBLIC_DIR = path.resolve(__dirname, '../../../../../public');
const KB = 1024;

const HOST_FACTS: PosterFacts = {
  propertyName: 'Azure Studio',
  brandName: null,
  location: 'Azure North, Pampanga',
  checkIn: '2:00 PM',
  checkOut: null,
  securityDeposit: null,
  nightlyRate: null,
  amenities: ['Pool'],
  logoUrl: null,
  photos: ['https://example.com/a.jpg'],
};

function formState(sample: AiStudioSample, referenceIds: string[] = []) {
  const state = sampleToCreateState(sample, { allowHighResolution: true });
  return {
    output: sample.output,
    text: state.text,
    goal: state.output === 'post' ? state.goal : 'vibe',
    format: state.output === 'post' ? state.format : 'instagram-portrait',
    aspect: state.output === 'post' ? '1:1' : state.aspect,
    lookId: state.output === 'image' ? state.lookId : null,
    tier: state.output === 'post' ? 'standard' : state.tier,
    imageSize: state.output === 'image' ? state.imageSize : '1K',
    resolution: state.output === 'video' ? state.resolution : '1080p',
    allowHighResolution: true,
    cameraMove: state.output === 'video' ? state.cameraMove : DEFAULT_VIDEO_CAMERA_MOVE,
    sound: state.output === 'video' ? state.sound : DEFAULT_VIDEO_SOUND,
    enhance: state.output === 'post' ? true : state.enhance,
    referenceIds,
    sampleId: sample.id,
    preferredArchetype: sample.output === 'post' ? sample.archetype : null,
  } as const;
}

describe('AI Studio example catalog', () => {
  it('has unique, URL-safe ids and a unique order per output', () => {
    const ids = AI_STUDIO_SAMPLES.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sample of AI_STUDIO_SAMPLES) expect(isSampleIdShape(sample.id)).toBe(true);
    for (const group of [POST_SAMPLES, PHOTO_SAMPLES, CLIP_SAMPLES]) {
      const orders = group.map((sample) => sample.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it('matches the agreed size of the first set', () => {
    expect(POST_SAMPLES).toHaveLength(6);
    expect(PHOTO_SAMPLES).toHaveLength(6);
    expect(CLIP_SAMPLES).toHaveLength(4);
  });

  it('uses only valid post angles, layouts and sizes', () => {
    for (const sample of POST_SAMPLES) {
      expect(POSTER_GOALS).toContain(sample.goal);
      expect(POSTER_ARCHETYPE_IDS).toContain(sample.archetype);
      // The rule-based fallback must contain the picked layout so it can lead the batch.
      expect(POSTER_GOAL_ARCHETYPES[sample.goal]).toContain(sample.archetype);
      expect(POST_FORMATS.map((format) => format.value)).toContain(sample.format);
    }
  });

  it('uses only valid photo looks and sizes', () => {
    for (const sample of PHOTO_SAMPLES) {
      if (sample.lookId) expect(GENERATION_LOOKS.map((look) => look.id)).toContain(sample.lookId);
      expect(IMAGE_ASPECT_RATIO_OPTIONS.map((option) => option.value)).toContain(sample.aspect);
      expect(sample.tier).toBe('standard');
    }
  });

  it('uses only valid clip moves, sounds and sizes', () => {
    for (const sample of CLIP_SAMPLES) {
      expect(VIDEO_CAMERA_MOVES.map((move) => move.id)).toContain(sample.cameraMove);
      expect(VIDEO_SOUND_MODES.map((mode) => mode.value)).toContain(sample.sound);
      expect(VIDEO_ASPECT_RATIO_OPTIONS.map((option) => option.value)).toContain(sample.aspect);
      expect(sample.tier).toBe('standard');
    }
  });

  it('keeps every prompt within the create form limit', () => {
    for (const sample of AI_STUDIO_SAMPLES) {
      expect(sample.prompt.length).toBeLessThanOrEqual(samplePromptLimit(sample.output));
    }
  });

  it('writes plain copy with no em dash', () => {
    for (const sample of AI_STUDIO_SAMPLES) {
      for (const text of [sample.title, sample.need, sample.prompt]) {
        expect(text).not.toMatch(/—/);
      }
    }
  });

  it('credits every stock photo it ships', () => {
    const sources = [
      ...PHOTO_SAMPLES.map((sample) => sample.source),
      ...CLIP_SAMPLES.map((sample) => sample.source),
      ...SHOWCASE_PHOTOS,
    ];
    for (const source of sources) {
      expect(source.photographer.trim()).not.toBe('');
      expect(source.pageUrl).toMatch(/^https:\/\/www\.pexels\.com\/photo\//);
    }
  });
});

describe('AI Studio example files', () => {
  it('ships the stock "before" photo of every photo and clip example within budget', () => {
    for (const sample of [...PHOTO_SAMPLES, ...CLIP_SAMPLES]) {
      const before = sourceImage(sample);
      const stem = before.src.replace(/-480\.webp$/, '');
      for (const file of [
        `${stem}-480.webp`,
        `${stem}-960.webp`,
        `${stem}-480.avif`,
        `${stem}-960.avif`,
      ]) {
        const full = path.join(PUBLIC_DIR, file);
        expect(existsSync(full), file).toBe(true);
        expect(statSync(full).size, file).toBeLessThanOrEqual(120 * KB);
      }
    }
  });

  it('ships the showcase listing photos used when a property has none', () => {
    for (const file of showcasePhotoPaths()) {
      expect(existsSync(path.join(PUBLIC_DIR, file)), file).toBe(true);
    }
  });

  it('lists as ready only photo/clip examples whose files all exist and fit the budget', () => {
    for (const id of READY_SAMPLE_IDS) {
      const sample = AI_STUDIO_SAMPLES.find((item) => item.id === id);
      expect(sample, id).toBeDefined();
      expect(sample?.output).not.toBe('post');
      if (!sample || sample.output === 'post') continue;
      for (const file of sampleFilePaths(sample)) {
        const full = path.join(PUBLIC_DIR, file);
        expect(existsSync(full), file).toBe(true);
        const limit = file.endsWith('.mp4') ? 1.5 * 1024 * KB : 120 * KB;
        expect(statSync(full).size, file).toBeLessThanOrEqual(limit);
      }
    }
  });
});

describe('readiness', () => {
  it('always lists post examples and hides photo/clip examples without files', () => {
    expect(listSamples('post', [])).toHaveLength(POST_SAMPLES.length);
    expect(listSamples('image', [])).toHaveLength(0);
    expect(listSamples('video', [])).toHaveLength(0);
    expect(listSamples('image', ['photo-golden-balcony']).map((s) => s.id)).toEqual([
      'photo-golden-balcony',
    ]);
  });

  it('lists in catalog order within an output', () => {
    const ids = listSamples('post', []).map((sample) => sample.order);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('finds only well-formed, ready ids', () => {
    expect(findSample('post-book-direct', [])?.id).toBe('post-book-direct');
    expect(findSample('photo-golden-balcony', [])).toBeNull();
    expect(findSample('photo-golden-balcony', ['photo-golden-balcony'])?.id).toBe(
      'photo-golden-balcony'
    );
    expect(findSample('nope', [])).toBeNull();
    expect(findSample('BAD ID', [])).toBeNull();
    expect(findSample(null, [])).toBeNull();
    expect(findSample(undefined, [])).toBeNull();
  });
});

describe('recipe → request', () => {
  it('fills a photo request with the exact recipe, look suffix included', () => {
    const sample = PHOTO_SAMPLES[0]!;
    const request = buildAiCreateRequest(formState(sample, ['ref-1']));
    expect(request.output).toBe('image');
    if (request.output !== 'image') return;
    expect(request.payload).toMatchObject({
      mediaType: 'image',
      prompt: samplePrompt(sample),
      qualityTier: 'standard',
      aspectRatio: sample.aspect,
      imageSize: sample.imageSize,
      referenceIds: ['ref-1'],
      enhancePrompt: sample.enhancePrompt,
      sampleId: sample.id,
    });
  });

  it('fills a clip request with camera, sound and resolution, without a look', () => {
    const sample = CLIP_SAMPLES[0]!;
    const request = buildAiCreateRequest(formState(sample, ['frame']));
    expect(request.output).toBe('video');
    if (request.output !== 'video') return;
    expect(request.payload).toMatchObject({
      mediaType: 'video',
      prompt: sample.prompt,
      cameraMove: sample.cameraMove,
      sound: sample.sound,
      aspectRatio: sample.aspect,
      resolution: sample.resolution,
      durationSeconds: 8,
      referenceIds: ['frame'],
      sampleId: sample.id,
    });
  });

  it('carries the picked layout and example id for posts', () => {
    const sample = POST_SAMPLES[1]!;
    const request = buildAiCreateRequest(formState(sample));
    expect(request).toEqual({
      output: 'post',
      goal: sample.goal,
      format: sample.format,
      prompt: sample.prompt,
      preferredArchetype: sample.archetype,
      sampleId: sample.id,
    });
  });

  it('sends no attribution when no example is applied', () => {
    const sample = PHOTO_SAMPLES[0]!;
    const request = buildAiCreateRequest({ ...formState(sample), sampleId: null });
    if (request.output !== 'image') throw new Error('expected image');
    expect('sampleId' in request.payload).toBe(false);
  });

  it('drops 1080p to 720p when the plan does not allow it, and credits follow', () => {
    const sample = { ...CLIP_SAMPLES[0]!, resolution: '1080p' as const };
    expect(sampleResolution(sample, { allowHighResolution: false })).toBe('720p');
    expect(sampleResolution(sample, { allowHighResolution: true })).toBe('1080p');
    expect(sampleCredits(sample, { allowHighResolution: false })).toBe(
      estimateGenerationCredits({
        mediaType: 'video',
        tier: 'standard',
        resolution: '720p',
        durationSeconds: 8,
      })
    );
  });

  it('shows the same credits as the Generate button and none for posts', () => {
    const photo = PHOTO_SAMPLES[0]!;
    expect(sampleCredits(photo, { allowHighResolution: true })).toBe(
      estimateGenerationCredits({ mediaType: 'image', tier: 'standard', imageSize: '1K' })
    );
    expect(sampleCredits(POST_SAMPLES[0]!, { allowHighResolution: true })).toBeNull();
  });
});

describe('post examples', () => {
  it('hides examples whose facts the listing lacks', () => {
    const amenity = POST_SAMPLES.find((sample) => sample.requires.includes('amenities'))!;
    const stay = POST_SAMPLES.find((sample) => sample.requires.includes('stayTimes'))!;
    const empty = { amenities: [], checkIn: null, checkOut: '  ' };
    expect(postSampleAvailable(amenity, empty)).toBe(false);
    expect(postSampleAvailable(stay, empty)).toBe(false);
    expect(postSampleAvailable(amenity, HOST_FACTS)).toBe(true);
    expect(postSampleAvailable(stay, HOST_FACTS)).toBe(true);
  });

  it('draws with the host listing when it has photos, the showcase when it has none', () => {
    const showcase = showcaseFacts('https://app.test');
    const sample = POST_SAMPLES[0]!;
    expect(postSampleFacts(sample, HOST_FACTS, showcase)).toEqual({
      facts: HOST_FACTS,
      showcase: false,
    });
    expect(postSampleFacts(sample, { ...HOST_FACTS, photos: [] }, showcase)).toEqual({
      facts: showcase,
      showcase: true,
    });
    const stay = POST_SAMPLES.find((item) => item.requires.includes('stayTimes'))!;
    expect(
      postSampleFacts(stay, { ...HOST_FACTS, checkIn: null, checkOut: null }, showcase)
    ).toBeNull();
    // The showcase listing can show every example.
    for (const item of POST_SAMPLES) expect(postSampleAvailable(item, showcase)).toBe(true);
    expect(showcase.photos.every((url) => url.startsWith('https://app.test/'))).toBe(true);
  });

  it('changes the cache key whenever what the post shows changes', () => {
    const base = {
      propertyId: 'p1',
      sampleId: 'post-book-direct',
      themeKey: 't1',
      facts: HOST_FACTS,
    };
    const key = postSampleCacheKey(base);
    expect(postSampleCacheKey(base)).toBe(key);
    expect(postSampleCacheKey({ ...base, themeKey: 't2' })).not.toBe(key);
    expect(postSampleCacheKey({ ...base, propertyId: 'p2' })).not.toBe(key);
    expect(postSampleCacheKey({ ...base, sampleId: 'post-night-in' })).not.toBe(key);
    expect(
      postSampleCacheKey({
        ...base,
        facts: { ...HOST_FACTS, photos: ['https://example.com/b.jpg'] },
      })
    ).not.toBe(key);
    expect(
      postSampleCacheKey({ ...base, facts: { ...HOST_FACTS, propertyName: 'Renamed' } })
    ).not.toBe(key);
  });

  it('puts the picked layout first only when it passes layout QA', () => {
    const batch = [
      { spec: { archetype: 'wave-duo' }, issues: 0 },
      { spec: { archetype: 'night-glass' }, issues: 0 },
      { spec: { archetype: 'sky-headline' }, issues: 2 },
      { spec: { archetype: 'feature-sticker' }, issues: 0 },
    ];
    expect(orderPosterBatch(batch, 'night-glass').map((item) => item.spec.archetype)).toEqual([
      'night-glass',
      'wave-duo',
      'feature-sticker',
      'sky-headline',
    ]);
    // A picked layout with issues keeps its QA place.
    expect(orderPosterBatch(batch, 'sky-headline').map((item) => item.spec.archetype)).toEqual([
      'wave-duo',
      'night-glass',
      'feature-sticker',
      'sky-headline',
    ]);
    expect(orderPosterBatch(batch, null).map((item) => item.issues)).toEqual([0, 0, 0, 2]);
    expect(orderPosterBatch(batch, 'magazine-cover')[0]?.spec.archetype).toBe('wave-duo');
  });
});
