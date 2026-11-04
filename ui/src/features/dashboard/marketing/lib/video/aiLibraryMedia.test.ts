import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { MarketingMediaAsset } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import {
  AI_LIBRARY_MAX_IMAGES,
  bindingWithLibraryClips,
  libraryClipsForAi,
} from '@/features/dashboard/marketing/lib/video/aiLibraryMedia';

const asset = (over: Partial<MarketingMediaAsset>): MarketingMediaAsset => ({
  id: over.id ?? 'a',
  kind: 'image',
  source: 'upload',
  fileName: 'f',
  mimeType: 'image/jpeg',
  url: `https://x/${over.id ?? 'a'}.jpg`,
  posterUrl: null,
  sizeBytes: 1,
  width: 1,
  height: 1,
  durationMs: null,
  peaks: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const binding: DesignBinding = {
  propertyName: 'Casa',
  propertyPhoto: 'https://x/gallery.jpg',
  propertyMedia: [{ url: 'https://x/gallery.jpg', type: 'image' }],
  nightlyRate: '',
  availabilityText: '',
  monthLabel: '',
  monthShort: '',
  openSlots: [],
};

describe('libraryClipsForAi', () => {
  it('takes newest first and caps each kind', () => {
    const images = Array.from({ length: 9 }, (_, i) =>
      asset({ id: `i${i}`, createdAt: `2026-10-0${i + 1}T00:00:00Z` })
    );
    const clips = libraryClipsForAi(images);
    expect(clips).toHaveLength(AI_LIBRARY_MAX_IMAGES);
    expect(clips[0]!.url).toBe('https://x/i8.jpg');
  });

  it('skips audio, long videos and non-http urls, and caps videos', () => {
    const clips = libraryClipsForAi([
      asset({ id: 'au', kind: 'audio', url: 'https://x/a.mp3' }),
      asset({ id: 'long', kind: 'video', url: 'https://x/l.mp4', durationMs: 60_000 }),
      asset({ id: 'v1', kind: 'video', url: 'https://x/v1.mp4', durationMs: 8000 }),
      asset({ id: 'v2', kind: 'video', url: 'https://x/v2.mp4', durationMs: 8000 }),
      asset({ id: 'v3', kind: 'video', url: 'https://x/v3.mp4', durationMs: 8000 }),
      asset({ id: 'bad', url: 'data:image/png;base64,AAAA' }),
    ]);
    expect(clips.map((c) => c.type)).toEqual(['video', 'video']);
  });
});

describe('bindingWithLibraryClips', () => {
  it('puts uploads first and drops duplicates', () => {
    const next = bindingWithLibraryClips(binding, [
      { url: 'https://x/up.jpg', type: 'image' },
      { url: 'https://x/gallery.jpg', type: 'image' },
    ]);
    expect(next.propertyMedia!.map((m) => m.url)).toEqual([
      'https://x/up.jpg',
      'https://x/gallery.jpg',
    ]);
  });

  it('returns the same binding when there are no uploads', () => {
    expect(bindingWithLibraryClips(binding, [])).toBe(binding);
  });
});
