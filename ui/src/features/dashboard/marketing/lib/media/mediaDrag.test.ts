import { describe, expect, it } from 'vitest';

import {
  hasMediaDrag,
  MARKETING_MEDIA_DRAG_TYPE,
  payloadFromAsset,
  readMediaDrag,
  writeMediaDrag,
} from '@/features/dashboard/marketing/lib/media/mediaDrag';

function fakeTransfer() {
  const store = new Map<string, string>();
  return {
    setData: (t: string, v: string) => void store.set(t, v),
    getData: (t: string) => store.get(t) ?? '',
    get types() {
      return [...store.keys()];
    },
    effectAllowed: 'none',
  };
}

const asset = {
  id: 'a1',
  kind: 'video' as const,
  source: 'upload' as const,
  fileName: 'clip.mp4',
  mimeType: 'video/mp4',
  url: 'https://x/clip.mp4',
  posterUrl: 'https://x/p.jpg',
  sizeBytes: 1,
  width: 1080,
  height: 1920,
  durationMs: 4000,
  peaks: null,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('media drag payload', () => {
  it('round-trips an asset', () => {
    const dt = fakeTransfer();
    writeMediaDrag(dt as never, payloadFromAsset(asset));
    expect(hasMediaDrag(dt)).toBe(true);
    expect(readMediaDrag(dt)).toEqual({
      kind: 'video',
      url: 'https://x/clip.mp4',
      assetId: 'a1',
      source: 'library',
      width: 1080,
      height: 1920,
      durationMs: 4000,
      posterUrl: 'https://x/p.jpg',
      title: 'clip.mp4',
    });
    expect(dt.effectAllowed).toBe('copy');
  });

  it('ignores foreign, malformed and unsafe drops', () => {
    expect(readMediaDrag(null)).toBeNull();
    expect(hasMediaDrag(null)).toBe(false);
    expect(readMediaDrag(fakeTransfer())).toBeNull();
    const bad = (json: string) => {
      const dt = fakeTransfer();
      dt.setData(MARKETING_MEDIA_DRAG_TYPE, json);
      return readMediaDrag(dt);
    };
    expect(bad('not json')).toBeNull();
    expect(bad('{"kind":"image"}')).toBeNull();
    expect(bad('{"kind":"gif","url":"https://x"}')).toBeNull();
    expect(bad('{"kind":"image","url":"javascript:alert(1)"}')).toBeNull();
    expect(bad('{"kind":"image","url":"data:image/png;base64,AA"}')).toBeNull();
    expect(
      bad('{"kind":"image","url":"https://x/a.jpg","width":"big","source":"evil"}')
    ).toMatchObject({
      width: null,
      source: 'library',
    });
  });
});
