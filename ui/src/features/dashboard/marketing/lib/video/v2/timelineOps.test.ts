import { describe, expect, it } from 'vitest';

import {
  addTrack,
  deleteItems,
  duplicateItem,
  findItem,
  insertItem,
  mainInsertIndex,
  moveItem,
  normalizeProject,
  pasteItems,
  removeEmptyTracks,
  reorderTrack,
  resolveOverlaps,
  setPlaybackRate,
  setTransition,
  snapFrame,
  snapMove,
  splitItems,
  trimItem,
  updateItem,
  updateTrack,
  validateProject,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  contentEndFrame,
  mainTrackOf,
  projectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  VIDEO_V2_LIMITS,
  type MediaItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  caption,
  clip,
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const mainItems = (p: ReturnType<typeof project>) => mainTrackOf(p).items as MediaItem[];
const expectValid = (p: ReturnType<typeof project>) => expect(validateProject(p)).toEqual([]);

describe('main track is magnetic', () => {
  it('lays clips out contiguously and derives from', () => {
    const p = normalizeProject(project([track('main', [photo(60), photo(90), photo(30)])]));
    expect(mainItems(p).map((i) => i.from)).toEqual([0, 60, 150]);
    expectValid(p);
  });

  it('transition overlap pulls the next clip earlier (matches v1 scene math)', () => {
    const second = photo(90, { transitionIn: { type: 'fade', durationInFrames: 15 } });
    const p = normalizeProject(project([track('main', [photo(90), second, photo(90)])]));
    expect(mainItems(p).map((i) => i.from)).toEqual([0, 75, 165]);
    expect(projectDurationInFrames(p)).toBe(255);
  });

  it('ignores a transition on the first clip', () => {
    const first = photo(90, { transitionIn: { type: 'fade', durationInFrames: 15 } });
    const p = normalizeProject(project([track('main', [first, photo(90)])]));
    expect(mainItems(p)[0]!.transitionIn).toBeUndefined();
  });

  it('caps a transition at half the shorter neighbour', () => {
    const b = photo(20, { transitionIn: { type: 'fade', durationInFrames: 15 } });
    const p = normalizeProject(project([track('main', [photo(90), b])]));
    expect(mainItems(p)[1]!.from).toBe(80);
  });

  it('inserts at the drop position and ripples', () => {
    const a = photo(60);
    const b = photo(60);
    let p = normalizeProject(project([track('main', [a, b])]));
    const c = photo(30);
    const r = insertItem(p, c, { atFrame: 50 });
    expect(r.ok).toBe(true);
    p = r.project;
    expect(mainItems(p).map((i) => i.id)).toEqual([a.id, c.id, b.id]);
    expect(mainItems(p).map((i) => i.from)).toEqual([0, 60, 90]);
    expectValid(p);
  });

  it('computes the insert index by clip midpoint', () => {
    const p = normalizeProject(project([track('main', [photo(60), photo(60)])]));
    expect(mainInsertIndex(p, 10)).toBe(0);
    expect(mainInsertIndex(p, 40)).toBe(1);
    expect(mainInsertIndex(p, 500)).toBe(2);
    expect(mainInsertIndex(p, 40, [mainItems(p)[0]!.id])).toBe(0);
  });

  it('delete ripples the main track', () => {
    const a = photo(60);
    const b = photo(60);
    const c = photo(60);
    const p = normalizeProject(project([track('main', [a, b, c])]));
    const r = deleteItems(p, [b.id]);
    expect(mainItems(r.project).map((i) => i.from)).toEqual([0, 60]);
    expectValid(r.project);
  });

  it('reorders by moving a clip', () => {
    const a = photo(60);
    const b = photo(60);
    const c = photo(60);
    const p = normalizeProject(project([track('main', [a, b, c])]));
    const r = moveItem(p, a.id, { frame: 170 });
    expect(mainItems(r.project).map((i) => i.id)).toEqual([b.id, c.id, a.id]);
    expect(mainItems(r.project).map((i) => i.from)).toEqual([0, 60, 120]);
    expectValid(r.project);
  });

  it('refuses to extend the main track past 60 s and clamps new clips to the room left', () => {
    const p = normalizeProject(project([track('main', [photo(1700)])]));
    const r = insertItem(p, photo(300), { atFrame: 2000 });
    expect(r.ok).toBe(true);
    expect(r.clamped).toBe(true);
    expect(contentEndFrame(r.project)).toBe(VIDEO_V2_LIMITS.maxDurationFrames);
    const full = insertItem(r.project, photo(90));
    expect(full.ok).toBe(false);
    expect(full.reason).toBe('duration_limit');
  });
});

describe('free tracks never overlap', () => {
  it('places a caption on a text track', () => {
    const p = normalizeProject(project([track('main', [photo(300)]), track('text')]));
    const r = insertItem(p, caption(), { atFrame: 30 });
    expect(r.ok).toBe(true);
    expect(r.project.tracks[1]!.items[0]!.from).toBe(30);
    expectValid(r.project);
  });

  it('creates a new text track instead of overlapping', () => {
    const p = normalizeProject(
      project([track('main', [photo(300)]), track('text', [caption(0, 100)])])
    );
    const r = insertItem(p, caption(), { atFrame: 50 });
    expect(r.ok).toBe(true);
    expect(r.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(2);
    expectValid(r.project);
  });

  it('creates a text track when none exists, above overlays', () => {
    const p = normalizeProject(project([track('main', [photo(300)]), track('audio')]));
    const r = insertItem(p, caption(), { atFrame: 0 });
    expect(r.project.tracks.map((t) => t.kind)).toEqual(['main', 'text', 'audio']);
  });

  it('respects the track cap', () => {
    const tracks = [track('main', [photo(300)])];
    for (let i = 0; i < VIDEO_V2_LIMITS.maxTracks - 1; i += 1)
      tracks.push(track('text', [caption(0, 300)]));
    const r = insertItem(normalizeProject(project(tracks)), caption(0, 50), { atFrame: 10 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('track_limit');
  });

  it('respects the item cap', () => {
    const items = Array.from({ length: VIDEO_V2_LIMITS.maxItems }, (_, i) => caption(i * 10, 5));
    const p = normalizeProject(project([track('main'), track('text', items)]));
    const r = insertItem(p, caption(), { atFrame: 1700 });
    expect(r.reason).toBe('item_limit');
  });

  it('rejects incompatible tracks and locked tracks', () => {
    const t = track('text', [], { locked: true });
    const p = normalizeProject(project([track('main'), t]));
    expect(insertItem(p, caption(), { trackId: t.id }).reason).toBe('locked');
    expect(insertItem(p, photo(), { trackId: t.id }).reason).toBe('incompatible');
    expect(insertItem(p, photo(), { trackId: 'missing' }).reason).toBe('not_found');
  });

  it('clamps a drop that would end past 60 s', () => {
    const p = normalizeProject(project([track('main', [photo(300)]), track('text')]));
    const r = insertItem(p, caption(0, 120), { atFrame: 1790 });
    expect(r.ok).toBe(true);
    expect(r.clamped).toBe(true);
    expect(r.project.tracks[1]!.items[0]!.from).toBe(1800 - 120);
    expectValid(r.project);
  });

  it('moves within a track and between tracks, avoiding overlap', () => {
    const a = caption(0, 60);
    const b = caption(100, 60);
    const t1 = track('text', [a, b]);
    const t2 = track('text', [caption(200, 60)]);
    const p = normalizeProject(project([track('main', [photo(400)]), t1, t2]));
    const slide = moveItem(p, a.id, { frame: 50 });
    expect(slide.ok).toBe(true);
    expect(findItem(slide.project, a.id)!.item.from).toBe(50);
    // Dropping onto b forces a new track rather than overlapping.
    const collide = moveItem(p, a.id, { frame: 110, trackId: t1.id });
    expect(collide.project.tracks.filter((t) => t.kind === 'text').length).toBeGreaterThanOrEqual(
      2
    );
    expectValid(collide.project);
    const across = moveItem(p, a.id, { frame: 0, trackId: t2.id });
    expect(findItem(across.project, a.id)!.track.id).toBe(t2.id);
    expectValid(across.project);
  });

  it('does not move items off locked tracks or into the wrong kind', () => {
    const a = caption(0, 60);
    const t1 = track('text', [a], { locked: true });
    const audio = track('audio');
    const p = normalizeProject(project([track('main'), t1, audio]));
    expect(moveItem(p, a.id, { frame: 10 }).reason).toBe('locked');
    const t = track('text', [caption(0, 30)]);
    const q = normalizeProject(project([track('main'), t, audio]));
    expect(moveItem(q, t.items[0]!.id, { frame: 0, trackId: audio.id }).reason).toBe(
      'incompatible'
    );
  });

  it('moves media between main and overlay tracks', () => {
    const a = photo(60);
    const b = photo(60);
    const overlay = track('overlay');
    const p = normalizeProject(project([track('main', [a, b]), overlay]));
    const out = moveItem(p, a.id, { frame: 10, trackId: overlay.id });
    expect(out.ok).toBe(true);
    expect(mainItems(out.project).map((i) => i.id)).toEqual([b.id]);
    expect(mainItems(out.project)[0]!.from).toBe(0);
    const overlayItem = findItem(out.project, a.id)!.item as MediaItem;
    expect(overlayItem.transform.widthPct).toBeLessThanOrEqual(60);
    const back = moveItem(out.project, a.id, { frame: 0, trackId: mainTrackOf(out.project).id });
    expect(mainItems(back.project).map((i) => i.id)).toEqual([a.id, b.id]);
    expectValid(back.project);
  });

  it('deletes with and without ripple on free tracks', () => {
    const a = caption(0, 30);
    const b = caption(30, 30);
    const c = caption(100, 30);
    const p = normalizeProject(project([track('main', [photo(300)]), track('text', [a, b, c])]));
    const plain = deleteItems(p, [b.id]);
    expect(plain.project.tracks[1]!.items.map((i) => i.from)).toEqual([0, 100]);
    const ripple = deleteItems(p, [b.id], { ripple: true });
    expect(ripple.project.tracks[1]!.items.map((i) => i.from)).toEqual([0, 70]);
    expect(deleteItems(p, ['nope']).reason).toBe('not_found');
  });
});

describe('trim', () => {
  it('trims the end of an image and ripples the main track', () => {
    const a = photo(90);
    const b = photo(90);
    const p = normalizeProject(project([track('main', [a, b])]));
    const r = trimItem(p, a.id, 'end', 60);
    expect(mainItems(r.project).map((i) => [i.from, i.durationInFrames])).toEqual([
      [0, 60],
      [60, 90],
    ]);
  });

  it('enforces a minimum length', () => {
    const a = photo(90);
    const p = normalizeProject(project([track('main', [a])]));
    const r = trimItem(p, a.id, 'end', 0);
    expect(r.clamped).toBe(true);
    expect(mainItems(r.project)[0]!.durationInFrames).toBe(VIDEO_V2_LIMITS.minItemFrames);
  });

  it('video: start trim advances trimBefore at 1x and keeps the left edge on main', () => {
    const v = clip(150, 10);
    const p = normalizeProject(project([track('main', [v])]));
    const r = trimItem(p, v.id, 'start', 30);
    const out = mainItems(r.project)[0] as MediaItem;
    expect(out.from).toBe(0);
    expect(out.durationInFrames).toBe(120);
    expect(out.trimBeforeFrames).toBe(30);
  });

  it('video: cannot extend past the source length or before its start', () => {
    const v = clip(150, 10); // 300 source frames
    const p = normalizeProject(project([track('main', [v])]));
    const long = trimItem(p, v.id, 'end', 10_000);
    expect(mainItems(long.project)[0]!.durationInFrames).toBe(300);
    expect(long.clamped).toBe(true);
    const early = trimItem(p, v.id, 'start', -500);
    expect((mainItems(early.project)[0] as MediaItem).trimBeforeFrames).toBe(0);
    expect(early.clamped).toBe(true);
  });

  it('video: trimBefore limits end extension', () => {
    const v = clip(100, 10, { trimBeforeFrames: 100 });
    const p = normalizeProject(project([track('main', [v])]));
    const r = trimItem(p, v.id, 'end', 5000);
    expect(mainItems(r.project)[0]!.durationInFrames).toBe(200);
  });

  it('video: speed changes how much source a trim consumes', () => {
    const v = clip(100, 10, { playbackRate: 2, trimBeforeFrames: 0 });
    const p = normalizeProject(project([track('main', [v])]));
    const r = trimItem(p, v.id, 'start', 10);
    expect((mainItems(r.project)[0] as MediaItem).trimBeforeFrames).toBe(20);
    // 300 source frames at 2x is 150 timeline frames.
    const long = trimItem(p, v.id, 'end', 5000);
    expect(mainItems(long.project)[0]!.durationInFrames).toBe(150);
  });

  it('free track: trims by moving, stops at neighbours and 0', () => {
    const a = caption(0, 60);
    const b = caption(100, 60);
    const p = normalizeProject(project([track('main', [photo(400)]), track('text', [a, b])]));
    const endStop = trimItem(p, a.id, 'end', 500);
    expect(findItem(endStop.project, a.id)!.item.durationInFrames).toBe(100);
    expect(endStop.clamped).toBe(true);
    const startStop = trimItem(p, b.id, 'start', 10);
    expect(findItem(startStop.project, b.id)!.item.from).toBe(60);
    const startTrim = trimItem(p, b.id, 'start', 130);
    const trimmed = findItem(startTrim.project, b.id)!.item;
    expect([trimmed.from, trimmed.durationInFrames]).toEqual([130, 30]);
    const zero = trimItem(p, a.id, 'start', -40);
    expect(findItem(zero.project, a.id)!.item.from).toBe(0);
  });

  it('audio: trim advances trimBefore and re-fits fades', () => {
    const a = song(0, 120, 30, { fadeInFrames: 60, fadeOutFrames: 60 });
    const p = normalizeProject(project([track('main'), track('audio', [a])]));
    const r = trimItem(p, a.id, 'end', 40);
    const out = findItem(r.project, a.id)!.item as typeof a;
    expect(out.durationInFrames).toBe(40);
    expect((out.fadeInFrames ?? 0) + (out.fadeOutFrames ?? 0)).toBeLessThanOrEqual(40);
  });

  it('looping audio can be extended freely', () => {
    const a = song(0, 120, 3, { loop: true });
    const p = normalizeProject(project([track('main'), track('audio', [a])]));
    const r = trimItem(p, a.id, 'end', 900);
    expect(findItem(r.project, a.id)!.item.durationInFrames).toBe(900);
  });

  it('cannot extend the main track past 60 s', () => {
    const a = photo(1700);
    const p = normalizeProject(project([track('main', [a])]));
    const r = trimItem(p, a.id, 'end', 5000);
    expect(mainItems(r.project)[0]!.durationInFrames).toBe(1800);
  });
});

describe('split', () => {
  it('splits a video and continues the source (no repeated footage)', () => {
    const v = clip(150, 20, { trimBeforeFrames: 30 });
    const p = normalizeProject(project([track('main', [v])]));
    const r = splitItems(p, [v.id], 60);
    expect(r.ok).toBe(true);
    const [first, second] = mainItems(r.project) as MediaItem[];
    expect([first!.durationInFrames, second!.durationInFrames]).toEqual([60, 90]);
    expect(first!.trimBeforeFrames).toBe(30);
    expect(second!.trimBeforeFrames).toBe(90);
    expect(second!.from).toBe(60);
    expectValid(r.project);
  });

  it('respects speed when computing the second half trim', () => {
    const v = clip(100, 20, { playbackRate: 1.5, trimBeforeFrames: 0 });
    const p = normalizeProject(project([track('main', [v])]));
    const r = splitItems(p, [v.id], 40);
    expect((mainItems(r.project)[1] as MediaItem).trimBeforeFrames).toBe(60);
  });

  it('the second half of a main clip has no transition', () => {
    const b = photo(90, { transitionIn: { type: 'fade', durationInFrames: 15 } });
    const p = normalizeProject(project([track('main', [photo(90), b])]));
    const r = splitItems(p, [b.id], 120);
    const items = mainItems(r.project);
    expect(items[1]!.transitionIn).toBeDefined();
    expect(items[2]!.transitionIn).toBeUndefined();
    expectValid(r.project);
  });

  it('splits captions into two independent layers with distinct ids', () => {
    const c = caption(0, 100);
    const p = normalizeProject(project([track('main', [photo(300)]), track('text', [c])]));
    const r = splitItems(p, [c.id], 40);
    const items = r.project.tracks[1]!.items as (typeof c)[];
    expect(items).toHaveLength(2);
    expect(items[0]!.layer.id).not.toBe(items[1]!.layer.id);
    expect(items[0]!.id).not.toBe(items[1]!.id);
  });

  it('splits audio and continues the source, moving the fade-out to the tail', () => {
    const a = song(0, 120, 30, { trimBeforeFrames: 10, fadeInFrames: 5, fadeOutFrames: 10 });
    const p = normalizeProject(project([track('main'), track('audio', [a])]));
    const r = splitItems(p, [a.id], 50);
    const [first, second] = r.project.tracks[1]!.items as (typeof a)[];
    expect(second!.trimBeforeFrames).toBe(60);
    expect(first!.fadeOutFrames).toBe(0);
    expect(second!.fadeInFrames).toBe(0);
    expect(second!.fadeOutFrames).toBe(10);
  });

  it('refuses edge splits, missing items and locked tracks', () => {
    const v = photo(90);
    const p = normalizeProject(project([track('main', [v])]));
    expect(splitItems(p, [v.id], 0).ok).toBe(false);
    expect(splitItems(p, [v.id], 90).ok).toBe(false);
    expect(splitItems(p, [v.id], 1).ok).toBe(false);
    expect(splitItems(p, ['nope'], 30).ok).toBe(false);
    const locked = normalizeProject(project([track('main', [v], { locked: true })]));
    expect(splitItems(locked, [v.id], 30).reason).toBe('locked');
  });

  it('splits several selected items at the playhead', () => {
    const a = caption(0, 100);
    const b = caption(0, 80);
    const p = normalizeProject(
      project([track('main', [photo(300)]), track('text', [a]), track('text', [b])])
    );
    const r = splitItems(p, [a.id, b.id], 40);
    expect(r.itemIds).toHaveLength(2);
    expectValid(r.project);
  });
});

describe('duplicate and paste', () => {
  it('duplicates a main clip right after itself', () => {
    const a = photo(60, { transitionIn: { type: 'fade', durationInFrames: 15 } });
    const p = normalizeProject(project([track('main', [photo(60), a])]));
    const r = duplicateItem(p, a.id);
    expect(mainItems(r.project)).toHaveLength(3);
    expect(mainItems(r.project)[2]!.transitionIn).toBeUndefined();
    expectValid(r.project);
  });

  it('duplicates a caption after itself, on a new track when it collides', () => {
    const a = caption(0, 50);
    const b = caption(50, 50);
    const p = normalizeProject(project([track('main', [photo(300)]), track('text', [a, b])]));
    const r = duplicateItem(p, a.id);
    expect(r.ok).toBe(true);
    expect(r.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(2);
    expectValid(r.project);
  });

  it('fails when the duplicate would pass 60 s', () => {
    const a = caption(1780, 20);
    const p = normalizeProject(project([track('main', [photo(300)]), track('text', [a])]));
    expect(duplicateItem(p, a.id).reason).toBe('duration_limit');
  });

  it('pastes entries at the playhead preserving offsets and track kinds', () => {
    const a = caption(10, 30);
    const b = caption(60, 30);
    const p = normalizeProject(project([track('main', [photo(600)]), track('text', [a, b])]));
    const r = pasteItems(
      p,
      [
        { item: a, trackKind: 'text' },
        { item: b, trackKind: 'text' },
      ],
      300
    );
    expect(r.ok).toBe(true);
    const froms = r.project.tracks
      .filter((t) => t.kind === 'text')
      .flatMap((t) => t.items.map((i) => i.from))
      .sort((x, y) => x - y);
    expect(froms).toEqual([10, 60, 300, 350]);
    expectValid(r.project);
    expect(pasteItems(p, [], 0).ok).toBe(false);
  });
});

describe('updates, speed, transitions, tracks', () => {
  it('updateItem cannot change identity or timing', () => {
    const a = photo(60);
    const p = normalizeProject(project([track('main', [a])]));
    const r = updateItem(p, a.id, (item) => ({
      ...item,
      id: 'x',
      from: 999,
      durationInFrames: 1,
      label: 'Hi',
    }));
    const out = mainItems(r.project)[0]!;
    expect([out.id, out.from, out.durationInFrames, out.label]).toEqual([a.id, 0, 60, 'Hi']);
  });

  it('changing speed keeps the same source span', () => {
    const v = clip(100, 20);
    const p = normalizeProject(project([track('main', [v, photo(60)])]));
    const r = setPlaybackRate(p, v.id, 2);
    expect(mainItems(r.project)[0]!.durationInFrames).toBe(50);
    expect(mainItems(r.project)[1]!.from).toBe(50);
    const slow = setPlaybackRate(r.project, v.id, 0.5);
    expect(mainItems(slow.project)[0]!.durationInFrames).toBe(200);
    expect(setPlaybackRate(p, mainItems(p)[1]!.id, 2).reason).toBe('incompatible');
  });

  it('slowing down is capped by the free-track neighbour', () => {
    const v = clip(60, 20);
    const next = caption(100, 10);
    const p = normalizeProject(
      project([track('main'), track('overlay', [v]), track('text', [next])])
    );
    const r = setPlaybackRate(p, v.id, 0.5);
    expect(r.project.tracks[1]!.items[0]!.durationInFrames).toBeLessThanOrEqual(120);
    expectValid(r.project);
  });

  it('sets and clears transitions; never on the first clip', () => {
    const a = photo(90);
    const b = photo(90);
    const p = normalizeProject(project([track('main', [a, b])]));
    expect(setTransition(p, a.id, 'fade').reason).toBe('invalid');
    const on = setTransition(p, b.id, 'wipe', 20);
    expect(mainItems(on.project)[1]!.from).toBe(70);
    const off = setTransition(on.project, b.id, 'none');
    expect(mainItems(off.project)[1]!.from).toBe(90);
    expect(mainItems(off.project)[1]!.transitionIn).toBeUndefined();
  });

  it('refuses to remove a transition when the longer track would pass 60 s', () => {
    const p = normalizeProject(
      project([
        track('main', [
          photo(900),
          photo(930, { transitionIn: { type: 'fade', durationInFrames: 30 } }),
        ]),
      ])
    );
    expect(contentEndFrame(p)).toBe(1800);
    expect(setTransition(p, mainItems(p)[1]!.id, 'none').reason).toBe('duration_limit');
  });

  it('adds, reorders, flags and removes tracks (main is fixed)', () => {
    let p = normalizeProject(project([track('main', [photo(90)])]));
    p = addTrack(p, 'text').project;
    p = addTrack(p, 'audio').project;
    p = addTrack(p, 'overlay').project;
    expect(p.tracks.map((t) => t.kind)).toEqual(['main', 'overlay', 'text', 'audio']);
    const overlayId = p.tracks[1]!.id;
    expect(reorderTrack(p, p.tracks[0]!.id, 2).reason).toBe('invalid');
    const moved = reorderTrack(p, overlayId, 3);
    expect(moved.project.tracks[3]!.id).toBe(overlayId);
    expect(moved.project.tracks[0]!.kind).toBe('main');
    const flagged = updateTrack(p, overlayId, { hidden: true, locked: true });
    expect(flagged.project.tracks[1]).toMatchObject({ hidden: true, locked: true });
    const cleared = updateTrack(flagged.project, overlayId, { hidden: false, locked: false });
    expect(cleared.project.tracks[1]).not.toHaveProperty('hidden');
    expect(removeEmptyTracks(p).tracks.map((t) => t.kind)).toEqual(['main']);
  });
});

describe('snapping', () => {
  const base = normalizeProject(
    project([track('main', [photo(90), photo(90)]), track('text', [caption(200, 40)])])
  );

  it('snaps to edges, the playhead and 0 within the threshold', () => {
    const candidates = [0, 45, 90, 180, 200, 240];
    expect(snapFrame(92, candidates, 5).frame).toBe(90);
    expect(snapFrame(92, candidates, 5).target).toBe(90);
    expect(snapFrame(3, candidates, 5).frame).toBe(0);
  });

  it('falls back to the half-second grid, and is off when asked', () => {
    expect(snapFrame(33, [], 4)).toMatchObject({ frame: 30, snapped: true });
    expect(snapFrame(37, [], 4, { grid: false })).toMatchObject({ frame: 37, snapped: false });
    expect(snapFrame(37, [], 4)).toMatchObject({ frame: 37, snapped: false });
  });

  it('snaps a moving item by either edge and ignores itself', () => {
    const moving = { id: 'm', durationInFrames: 30 };
    const byEnd = snapMove(base, moving, 148, { playheadFrame: 600 }, 4);
    expect(byEnd.frame).toBe(150);
    const byStart = snapMove(base, moving, 181, { playheadFrame: 600, grid: false }, 4);
    expect(byStart.frame).toBe(180);
    const none = snapMove(base, moving, 400, { playheadFrame: 600, grid: false }, 4);
    expect(none.snapped).toBe(false);
    const caption0 = base.tracks[1]!.items[0]!;
    const self = snapMove(base, caption0, 201, { playheadFrame: 600, grid: false }, 4);
    expect(self.snapped).toBe(false);
  });
});

describe('normalize and resolveOverlaps', () => {
  it('is idempotent', () => {
    const p = normalizeProject(
      project([
        track('main', [photo(60), photo(60)]),
        track('text', [caption(30, 40), caption(0, 20)]),
      ])
    );
    expect(normalizeProject(p)).toEqual(p);
    expect(p.tracks[1]!.items.map((i) => i.from)).toEqual([0, 30]);
  });

  it('adds a main track when missing and drops misplaced item kinds', () => {
    const p = normalizeProject(project([track('text', [caption(), photo() as never])]));
    expect(p.tracks[0]!.kind).toBe('main');
    expect(p.tracks[1]!.items).toHaveLength(1);
  });

  it('cuts content past 60 s', () => {
    const p = normalizeProject(
      project([
        track('main', [photo(1700), photo(300)]),
        track('text', [caption(1900, 30), caption(1750, 100)]),
      ])
    );
    expect(contentEndFrame(p)).toBe(1800);
    expect(p.tracks[1]!.items).toHaveLength(1);
    expectValid(p);
  });

  it('resolveOverlaps spreads overlapping items over extra tracks', () => {
    const raw = project([
      track('main', [photo(300)]),
      track('text', [caption(0, 100), caption(50, 100), caption(60, 100)]),
    ]);
    const fixed = resolveOverlaps(normalizeProject(raw));
    expect(fixed.tracks.filter((t) => t.kind === 'text')).toHaveLength(3);
    expectValid(fixed);
    expect(resolveOverlaps(fixed)).toBe(fixed);
  });

  it('validateProject reports broken input', () => {
    const bad = project([
      track('main', [photo(60)]),
      track('text', [caption(0, 60), caption(30, 60)]),
    ]);
    expect(validateProject(bad).some((v) => v.includes('overlaps'))).toBe(true);
    expect(validateProject(project([track('text')])).length).toBeGreaterThan(0);
  });
});

describe('randomized operation sequences keep every invariant', () => {
  function rng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i', (seed) => {
    const rand = rng(seed);
    const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;
    let p = normalizeProject(project([track('main', [photo(90), clip(120, 12), photo(60)])]));
    for (let step = 0; step < 120; step += 1) {
      const items = p.tracks.flatMap((t) => t.items);
      const target = items.length ? pick(items) : null;
      const frame = Math.floor(rand() * 1900);
      const action = Math.floor(rand() * 12);
      let result;
      switch (action) {
        case 0:
          result = insertItem(p, photo(30 + Math.floor(rand() * 150)), { atFrame: frame });
          break;
        case 1:
          result = insertItem(p, caption(0, 20 + Math.floor(rand() * 200)), { atFrame: frame });
          break;
        case 2:
          result = insertItem(p, song(0, 60 + Math.floor(rand() * 300), 20), { atFrame: frame });
          break;
        case 3:
          result = insertItem(p, clip(60 + Math.floor(rand() * 120), 8), {
            kind: 'overlay',
            atFrame: frame,
          });
          break;
        case 4:
          result = target ? moveItem(p, target.id, { frame, trackId: pick(p.tracks).id }) : null;
          break;
        case 5:
          result = target ? trimItem(p, target.id, rand() > 0.5 ? 'start' : 'end', frame) : null;
          break;
        case 6:
          result = target ? splitItems(p, [target.id], frame) : null;
          break;
        case 7:
          result = target ? deleteItems(p, [target.id], { ripple: rand() > 0.5 }) : null;
          break;
        case 8:
          result = target ? duplicateItem(p, target.id) : null;
          break;
        case 9:
          result =
            target && target.type === 'video'
              ? setPlaybackRate(p, target.id, pick([0.5, 1, 1.5, 2] as const))
              : null;
          break;
        case 10:
          result = target
            ? setTransition(p, target.id, pick(['fade', 'wipe', 'none'] as const))
            : null;
          break;
        default:
          result = { project: removeEmptyTracks(p), ok: true };
      }
      if (result) p = result.project;
      expect(validateProject(p), `seed ${seed} step ${step} action ${action}`).toEqual([]);
    }
  });
});
