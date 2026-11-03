import { describe, expect, it } from 'vitest';

import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import {
  audioItemFromPayload,
  clipboardFor,
  duplicateItems,
  defaultClipFrames,
  insertPayload,
  itemAriaLabel,
  itemLabel,
  itemsUsingAsset,
  layerItemFromPreset,
  mediaItemFromPayload,
  projectHasAudio,
  projectWarnings,
  replaceItemMedia,
  textPresetById,
  TEXT_PRESETS,
  trackLabel,
} from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  insertItem,
  normalizeProject,
  validateProject,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import type { MediaItem } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  caption,
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const payload = (over: Partial<MediaDragPayload> = {}): MediaDragPayload => ({
  kind: 'image',
  url: 'https://x/a.jpg',
  assetId: 'asset-1',
  source: 'library',
  width: 1080,
  height: 1920,
  durationMs: null,
  posterUrl: null,
  title: 'a.jpg',
  ...over,
});

describe('building items from library drops', () => {
  it('stills get 3 s, video gets its source length, audio too', () => {
    expect(defaultClipFrames(payload(), 30, 0)).toBe(90);
    expect(defaultClipFrames(payload({ kind: 'video', durationMs: 4000 }), 30, 0)).toBe(120);
    expect(defaultClipFrames(payload({ kind: 'video', durationMs: null }), 30, 0)).toBe(90);
    expect(defaultClipFrames(payload({ kind: 'video', durationMs: 120_000 }), 30, 0)).toBe(1800);
    expect(defaultClipFrames(payload({ kind: 'video', durationMs: 20_000 }), 30, 1500)).toBe(300);
    expect(defaultClipFrames(payload(), 30, 1799)).toBe(3);
  });

  it('main clips are full frame, overlay clips are a centered 60% box', () => {
    const main = mediaItemFromPayload(payload(), { fps: 30, track: 'main' });
    expect(main.transform.widthPct).toBe(100);
    const overlay = mediaItemFromPayload(payload({ kind: 'video', durationMs: 2000 }), {
      fps: 30,
      track: 'overlay',
      from: 30,
    });
    expect(overlay).toMatchObject({
      type: 'video',
      from: 30,
      durationInFrames: 60,
      trimBeforeFrames: 0,
      volume: 1,
    });
    expect(overlay.transform.widthPct).toBe(60);
    expect(overlay.media).toMatchObject({ assetId: 'asset-1', source: 'library', width: 1080 });
    expect(() =>
      mediaItemFromPayload(payload({ kind: 'audio' }), { fps: 30, track: 'main' })
    ).toThrow();
  });

  it('builds audio at the default music volume', () => {
    const a = audioItemFromPayload(payload({ kind: 'audio', durationMs: 5000, title: 'Calm' }), {
      fps: 30,
      from: 10,
    });
    expect(a).toMatchObject({
      type: 'audio',
      from: 10,
      durationInFrames: 150,
      title: 'Calm',
      trimBeforeFrames: 0,
    });
    expect(a.volume).toBeGreaterThan(0);
  });

  it('inserting built items produces valid projects', () => {
    let p = normalizeProject(project());
    p = insertItem(p, mediaItemFromPayload(payload(), { fps: 30, track: 'main' })).project;
    p = insertItem(
      p,
      layerItemFromPreset(textPresetById('headline'), { from: 0, durationInFrames: 60 })
    ).project;
    p = insertItem(
      p,
      audioItemFromPayload(payload({ kind: 'audio', durationMs: 90_000 }), { fps: 30 })
    ).project;
    expect(validateProject(p)).toEqual([]);
    expect(p.tracks.map((t) => t.kind)).toEqual(['main', 'text', 'audio']);
  });
});

describe('text presets', () => {
  it('every preset yields a layer with content, a position and animations', () => {
    for (const preset of TEXT_PRESETS) {
      const item = layerItemFromPreset(preset, { from: 12 });
      expect(item.from).toBe(12);
      expect(item.layer.text).toBeTruthy();
      expect(item.layer.position.x).toBeGreaterThanOrEqual(0);
      expect(item.animationIn?.type).toBeTruthy();
      expect(item.durationInFrames).toBe(90);
    }
    expect(layerItemFromPreset(textPresetById('cta'), { from: 0 }).layer.kind).toBe('cta');
    expect(
      layerItemFromPreset(textPresetById('headline'), { from: 0, text: 'Hi', durationInFrames: 1 })
    ).toMatchObject({
      durationInFrames: 3,
      layer: { text: 'Hi' },
    });
    expect(new Set(TEXT_PRESETS.map((p) => p.id)).size).toBe(TEXT_PRESETS.length);
  });

  it('gives each created item and layer a fresh id', () => {
    const a = layerItemFromPreset(TEXT_PRESETS[0]!, { from: 0 });
    const b = layerItemFromPreset(TEXT_PRESETS[0]!, { from: 0 });
    expect(a.id).not.toBe(b.id);
    expect(a.layer.id).not.toBe(b.layer.id);
  });
});

describe('labels and warnings', () => {
  it('describes items for the timeline and screen readers', () => {
    expect(itemLabel(caption(0, 30, 'Hello there'))).toBe('Hello there');
    expect(itemLabel(caption(0, 30, 'x'.repeat(80)))).toHaveLength(40);
    expect(itemLabel(photo())).toBe('Photo');
    expect(itemLabel(clip())).toBe('Video');
    expect(itemLabel(photo(60, { label: 'Pool' }))).toBe('Pool');
    expect(itemLabel(song(0, 60, 10, { title: 'Calm' }))).toBe('Calm');
    expect(itemAriaLabel({ ...caption(90, 120, 'Hello'), from: 90 }, 30)).toBe(
      'Text, Hello, 0:03 to 0:07'
    );
    expect(trackLabel('main', 0)).toBe('Main');
    expect(trackLabel('text', 1)).toBe('Text 2');
  });

  it('detects audible content', () => {
    expect(projectHasAudio(normalizeProject(project([track('main', [photo(60)])])))).toBe(false);
    expect(projectHasAudio(normalizeProject(project([track('main', [clip(60)])])))).toBe(true);
    expect(
      projectHasAudio(normalizeProject(project([track('main', [clip(60, 10, { muted: true })])])))
    ).toBe(false);
    expect(
      projectHasAudio(normalizeProject(project([track('main', [clip(60, 10, { volume: 0 })])])))
    ).toBe(false);
    expect(
      projectHasAudio(
        normalizeProject(project([track('main', [photo(60)]), track('audio', [song()])]))
      )
    ).toBe(true);
    expect(
      projectHasAudio(
        normalizeProject(
          project([track('main', [photo(60)]), track('audio', [song()], { muted: true })])
        )
      )
    ).toBe(false);
    expect(
      projectHasAudio(
        normalizeProject(
          project([track('main', [photo(60)]), track('audio', [song(0, 60, 10, { volume: 0 })])])
        )
      )
    ).toBe(false);
  });

  it('warns about too many videos, missing media and a nearly full timeline', () => {
    const many = normalizeProject(
      project([
        track('main', [clip(120)]),
        track('overlay', [clip(120)]),
        track('overlay', [clip(120)]),
        track('overlay', [clip(120)]),
      ])
    );
    expect(projectWarnings(many)).toEqual([{ code: 'too_many_videos', peak: 4 }]);
    const missing = normalizeProject(
      project([track('main', [photo(60, { media: { url: '', source: 'property' } })])])
    );
    expect(projectWarnings(missing)).toContainEqual({ code: 'missing_media', count: 1 });
    const full = normalizeProject(project([track('main', [photo(1790)])]));
    expect(projectWarnings(full)).toContainEqual({ code: 'nearly_full', seconds: 0 });
    expect(projectWarnings(normalizeProject(project([track('main', [photo(90)])])))).toEqual([]);
  });
});

describe('asset usage and replacement', () => {
  it('finds items that use an asset', () => {
    const a = photo(60, { media: { url: 'u', source: 'library', assetId: 'x' } });
    const b = song(0, 60, 10, { media: { url: 'u2', source: 'library', assetId: 'x' } });
    const p = normalizeProject(project([track('main', [a, photo(60)]), track('audio', [b])]));
    expect(itemsUsingAsset(p, 'x').sort()).toEqual([a.id, b.id].sort());
    expect(itemsUsingAsset(p, 'none')).toEqual([]);
  });

  it('replacing media keeps placement, resets trim and clamps video length to the new source', () => {
    const original = clip(200, 20, { trimBeforeFrames: 90, playbackRate: 2 });
    const swapped = replaceItemMedia(
      original,
      payload({ kind: 'video', durationMs: 4000, assetId: 'new' }),
      30
    ) as MediaItem;
    expect(swapped.media.assetId).toBe('new');
    expect(swapped.trimBeforeFrames).toBe(0);
    expect(swapped.durationInFrames).toBe(60); // 120 source frames at 2x
    const toImage = replaceItemMedia(original, payload(), 30) as MediaItem;
    expect(toImage.type).toBe('image');
    expect(toImage).not.toHaveProperty('trimBeforeFrames');
    expect(toImage).not.toHaveProperty('playbackRate');
    const audio = replaceItemMedia(song(), payload({ kind: 'audio' }), 30);
    expect(audio.type).toBe('audio');
  });
});

describe('insertPayload routes a drop by lane', () => {
  const mainTrackItem = photo(90);
  const base = normalizeProject(
    project([
      { ...track('main', [mainTrackItem]), id: 'm' },
      { ...track('overlay'), id: 'o' },
      { ...track('text', [caption(0, 60)]), id: 't' },
      { ...track('audio'), id: 'a' },
    ])
  );

  it('main drop ripples into the main track', () => {
    const r = insertPayload(base, payload(), { frame: 10, trackId: 'm', onMain: true });
    expect(r.ok).toBe(true);
    expect(r.project.tracks[0]!.items).toHaveLength(2);
    expect(validateProject(r.project)).toEqual([]);
  });

  it('overlay lane keeps the clip on that lane', () => {
    const r = insertPayload(base, payload({ kind: 'video', durationMs: 3000 }), {
      frame: 30,
      trackId: 'o',
      onMain: false,
    });
    expect(r.project.tracks.find((t) => t.id === 'o')!.items).toHaveLength(1);
  });

  it('a text lane (wrong kind) falls back to an overlay track instead of failing', () => {
    const r = insertPayload(base, payload(), { frame: 0, trackId: 't', onMain: false });
    expect(r.ok).toBe(true);
    expect(r.project.tracks.find((t) => t.id === 't')!.items).toHaveLength(1);
    expect(r.project.tracks.find((t) => t.id === 'o')!.items).toHaveLength(1);
  });

  it('audio goes to an audio track from any lane, creating one when missing', () => {
    const fromText = insertPayload(base, payload({ kind: 'audio', durationMs: 4000 }), {
      frame: 0,
      trackId: 't',
      onMain: false,
    });
    expect(fromText.project.tracks.find((t) => t.id === 'a')!.items).toHaveLength(1);
    const bare = normalizeProject(project([track('main', [photo(90)])]));
    const created = insertPayload(bare, payload({ kind: 'audio', durationMs: 4000 }), {
      frame: 0,
      trackId: null,
      onMain: false,
    });
    expect(created.project.tracks.map((t) => t.kind)).toEqual(['main', 'audio']);
  });

  it('a missing lane id with a visual payload goes to a new overlay', () => {
    const bare = normalizeProject(project([track('main', [photo(90)])]));
    const r = insertPayload(bare, payload(), { frame: 0, trackId: null, onMain: false });
    expect(r.project.tracks.map((t) => t.kind)).toEqual(['main', 'overlay']);
  });
});

describe('duplicateItems', () => {
  it('duplicates several items and reports the copies', () => {
    const a = caption(0, 30);
    const b = caption(60, 30);
    const p = project([track('main', [photo(120)]), track('text', [a, b])]);
    const result = duplicateItems(p, [a.id, b.id]);
    expect(result.ok).toBe(true);
    expect(result.itemIds).toHaveLength(2);
    expect(validateProject(result.project)).toEqual([]);
  });

  it('fails with the first refusal when nothing can be duplicated', () => {
    const result = duplicateItems(project(), ['missing']);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_found');
  });
});

describe('clipboardFor', () => {
  it('returns entries in timeline order with their track kinds and skips unknown ids', () => {
    const early = caption(0, 30);
    const late = caption(90, 30);
    const p = project([track('main', [photo(150)]), track('text', [early, late])]);
    const entries = clipboardFor(p, [late.id, 'nope', early.id]);
    expect(entries.map((e) => e.item.id)).toEqual([early.id, late.id]);
    expect(entries[0]!.trackKind).toBe('text');
  });
});

describe('audioItemFromPayload credits', () => {
  it('keeps the free-music track id and artist on the clip', () => {
    const item = audioItemFromPayload(
      payload({
        kind: 'audio',
        source: 'jamendo',
        assetId: null,
        durationMs: 30_000,
        title: 'Lofi',
        artist: 'Joystock',
        trackId: '42',
      }),
      { fps: 30, from: 0 }
    );
    expect(item).toMatchObject({ title: 'Lofi', artist: 'Joystock', trackId: '42' });
    expect(item.media.source).toBe('jamendo');
  });

  it('leaves the credit off for an uploaded file', () => {
    const item = audioItemFromPayload(payload({ kind: 'audio', durationMs: 5000 }), {
      fps: 30,
      from: 0,
    });
    expect('trackId' in item).toBe(false);
    expect('artist' in item).toBe(false);
  });
});
