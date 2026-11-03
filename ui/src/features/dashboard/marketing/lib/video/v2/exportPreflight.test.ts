import { describe, expect, it } from 'vitest';

import {
  collectExportMedia,
  exportBlockers,
  exportRenderOptions,
  findUnreachableMedia,
  itemsMissingMedia,
} from '@/features/dashboard/marketing/lib/video/v2/exportPreflight';
import {
  caption,
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

describe('exportBlockers', () => {
  it('blocks an empty main track', () => {
    expect(exportBlockers(project()).map((b) => b.code)).toEqual(['empty']);
  });

  it('allows a normal project', () => {
    expect(exportBlockers(project([track('main', [photo(90)])]))).toEqual([]);
  });

  it('blocks content past 60 s', () => {
    const p = project([track('main', [photo(90)]), track('audio', [song(0, 2000, 120)])]);
    expect(exportBlockers(p).map((b) => b.code)).toContain('too_long');
  });
});

describe('collectExportMedia', () => {
  it('lists unique files and skips hidden tracks and muted audio', () => {
    const a = photo(90, { media: { url: 'https://x/a.jpg', source: 'library' } });
    const dup = photo(90, { media: { url: 'https://x/a.jpg', source: 'library' } });
    const v = clip(90, 10, { media: { url: 'https://x/v.mp4', source: 'library' } });
    const hidden = photo(60, { media: { url: 'https://x/hidden.jpg', source: 'library' } });
    const p = project([
      track('main', [a, dup, v]),
      track('overlay', [hidden], { hidden: true }),
      track('audio', [song(0, 90)], { muted: true }),
      track('text', [caption(0, 30)]),
    ]);
    const refs = collectExportMedia(p);
    expect(refs.map((r) => r.url).sort()).toEqual(['https://x/a.jpg', 'https://x/v.mp4']);
  });

  it('includes audible audio and ignores silent audio and non-http urls', () => {
    const quiet = song(0, 60, 30, { volume: 0 });
    const blob = song(0, 60, 30, { media: { url: '', source: 'library' } });
    const loud = song(0, 60, 30, { media: { url: 'https://x/s.mp3', source: 'library' } });
    const p = project([track('main', [photo(90)]), track('audio', [quiet, blob, loud])]);
    expect(collectExportMedia(p).filter((r) => r.kind === 'audio')).toHaveLength(1);
  });
});

describe('itemsMissingMedia', () => {
  it('finds media items with an empty url', () => {
    const empty = photo(90, { media: { url: '  ', source: 'library' } });
    expect(itemsMissingMedia(project([track('main', [empty, photo(90)])]))).toEqual([empty.id]);
  });
});

describe('findUnreachableMedia', () => {
  const refs = [
    { itemId: '1', url: 'https://x/1', kind: 'image' as const },
    { itemId: '2', url: 'https://x/2', kind: 'video' as const },
    { itemId: '3', url: 'https://x/3', kind: 'audio' as const },
  ];

  it('returns failed refs in input order, including probes that throw', async () => {
    const failed = await findUnreachableMedia(refs, async (ref) => {
      if (ref.itemId === '3') throw new Error('boom');
      return { ok: ref.itemId !== '2' };
    });
    expect(failed.map((r) => r.itemId)).toEqual(['2', '3']);
  });

  it('bounds concurrency', async () => {
    let active = 0;
    let peak = 0;
    const many = Array.from({ length: 12 }, (_, i) => ({
      itemId: String(i),
      url: `https://x/${i}`,
      kind: 'image' as const,
    }));
    await findUnreachableMedia(
      many,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 2));
        active -= 1;
        return { ok: true };
      },
      { concurrency: 3 }
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('stops early when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const failed = await findUnreachableMedia(refs, async () => ({ ok: false }), {
      signal: controller.signal,
    });
    expect(failed).toEqual([]);
  });
});

describe('exportRenderOptions', () => {
  it('mutes when nothing makes sound', () => {
    expect(exportRenderOptions(project([track('main', [photo(90)])])).muted).toBe(true);
  });

  it('keeps audio for a project with music or an unmuted video', () => {
    expect(
      exportRenderOptions(project([track('main', [photo(90)]), track('audio', [song(0, 60)])]))
        .muted
    ).toBe(false);
    expect(exportRenderOptions(project([track('main', [clip(90)])])).muted).toBe(false);
  });
});
