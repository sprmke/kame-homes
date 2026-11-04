import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import { parseVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/parseVideoProjectV2';
import { validateProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  mainTrackOf,
  projectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isLayerItem,
  type MediaItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { layerHasContent } from '@/features/dashboard/marketing/lib/video/videoLayerContent';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type { VideoFormat } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneDurationInFrames,
  transitionDurationInFrames,
  videoProjectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import { getSceneLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { VIDEO_STORYBOARD_RECIPES } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

const binding: DesignBinding = {
  propertyName: 'Casa Azul',
  propertyPhoto: 'https://example.test/storage/v1/object/public/property-media/p/hero.jpg',
  propertyMedia: [
    { url: 'https://example.test/storage/v1/object/public/property-media/p/a.jpg', type: 'image' },
    { url: 'https://example.test/storage/v1/object/public/property-media/p/b.mp4', type: 'video' },
    { url: 'https://example.test/storage/v1/object/public/property-media/p/c.jpg', type: 'image' },
  ],
  nightlyRate: '₱3,500',
  availabilityText: 'Open this weekend',
  monthLabel: 'November 2026',
  monthShort: 'Nov',
  openSlots: [
    { dateNum: '7', dayName: 'Sat' },
    { dateNum: '8', dayName: 'Sun' },
  ],
};

/**
 * Where Remotion's TransitionSeries actually starts each scene: previous durations minus EVERY
 * transition overlap so far. (v1's `sceneStartFrame` only subtracts the scene's own transition,
 * so its editor selection drifts from the render after the second transition; v2 derives the
 * correct value, which is what this golden pins.)
 */
function renderedSceneStart(
  project: ReturnType<typeof buildDefaultVideoProject>,
  index: number
): number {
  let frame = 0;
  for (let i = 0; i < index; i += 1)
    frame += sceneDurationInFrames(project.scenes[i]!, project.fps);
  for (let i = 1; i <= index; i += 1) {
    frame -= transitionDurationInFrames(project.scenes[i]!.transition);
  }
  return frame;
}

const formats: VideoFormat[] = ['instagram-story', 'instagram-post', 'landscape'];

describe('v1 → v2 golden parity for every built-in storyboard', () => {
  for (const recipe of VIDEO_STORYBOARD_RECIPES) {
    for (const format of formats) {
      it(`${recipe.id} @ ${format}`, () => {
        const v1 = buildDefaultVideoProject(recipe.id, recipe.category, binding, format);
        const v2 = migrateVideoProjectV1(v1);

        expect(validateProject(v2)).toEqual([]);
        expect(v2.templateId).toBe(v1.templateId);
        expect(v2.format).toBe(format);

        // Timing: every scene starts and lasts exactly as in v1, and the totals agree.
        const main = mainTrackOf(v2).items as MediaItem[];
        expect(main).toHaveLength(v1.scenes.length);
        v1.scenes.forEach((scene, index) => {
          expect(main[index]!.from).toBe(renderedSceneStart(v1, index));
          expect(main[index]!.durationInFrames).toBe(sceneDurationInFrames(scene, v1.fps));
          expect(main[index]!.id).toBe(scene.id);
          expect(main[index]!.sceneKind).toBe(scene.kind);
        });
        expect(projectDurationInFrames(v2)).toBe(Math.min(1800, videoProjectDurationInFrames(v1)));

        // Transitions carry over (never on the first clip).
        v1.scenes.forEach((scene, index) => {
          if (index === 0 || scene.transition === 'none') {
            expect(main[index]!.transitionIn).toBeUndefined();
          } else {
            expect(main[index]!.transitionIn?.type).toBe(scene.transition);
          }
        });

        // Every visible overlay layer survives, in its scene's time range, with the same payload.
        const layerItems = v2.tracks.flatMap((t) => t.items).filter(isLayerItem);
        const expectedLayers = v1.scenes.flatMap((scene) =>
          getSceneLayers(scene).filter((l) => l.kind !== 'background' && layerHasContent(l))
        );
        expect(layerItems).toHaveLength(expectedLayers.length);
        v1.scenes.forEach((scene, index) => {
          const start = main[index]!.from;
          const end = start + main[index]!.durationInFrames;
          const mine = layerItems.filter((item) => item.id.startsWith(`${scene.id}:`));
          for (const item of mine) {
            expect(item.from).toBe(start);
            expect(item.from + item.durationInFrames).toBeLessThanOrEqual(end);
            expect(item.durationInFrames).toBeGreaterThan(0);
            const original = getSceneLayers(scene).find((l) => item.id.endsWith(`:${l.id}`));
            expect(item.layer).toEqual(original);
          }
        });

        // Compact: a scene never needs more text tracks than it has layers.
        const maxLayers = Math.max(
          0,
          ...v1.scenes.map(
            (scene) =>
              getSceneLayers(scene).filter((l) => l.kind !== 'background' && layerHasContent(l))
                .length
          )
        );
        expect(v2.tracks.filter((t) => t.kind === 'text')).toHaveLength(maxLayers);
      });
    }
  }
});

describe('migration details', () => {
  const v1 = buildDefaultVideoProject('quiet-morning', 'soft-stay', binding, 'instagram-story');

  it('keeps v1 background videos muted and looping semantics via muted video clips', () => {
    const withVideo = {
      ...v1,
      scenes: v1.scenes.map((scene, i) =>
        i === 0
          ? {
              ...scene,
              imageUrl: 'https://example.test/x.mp4',
              backgroundMediaType: 'video' as const,
              layers: [
                {
                  id: 'bg',
                  kind: 'background' as const,
                  imageUrl: 'https://example.test/x.mp4',
                  mediaType: 'video' as const,
                  position: { x: 50, y: 50 },
                },
              ],
            }
          : scene
      ),
    };
    const first = mainTrackOf(migrateVideoProjectV1(withVideo)).items[0]!;
    expect(first.type).toBe('video');
    expect(first).toMatchObject({ muted: true, volume: 0, trimBeforeFrames: 0 });
  });

  it('maps music to one looping audio clip over the whole project', () => {
    const music = migrateVideoProjectV1({
      ...v1,
      music: {
        url: 'https://example.test/song.mp3',
        volume: 0.3,
        title: 'Calm',
        source: 'jamendo',
      },
    });
    const audio = music.tracks.find((t) => t.kind === 'audio')!.items[0]!;
    expect(audio).toMatchObject({ type: 'audio', from: 0, loop: true, volume: 0.3, title: 'Calm' });
    expect(audio.durationInFrames).toBe(projectDurationInFrames(music));
    expect(
      migrateVideoProjectV1({ ...v1, music: { url: null, volume: 0.5 } }).tracks.some(
        (t) => t.kind === 'audio'
      )
    ).toBe(false);
  });

  it('keeps palette and sourceReviewId, and handles scenes without a background', () => {
    const palette = { accent: '#fff', ink: '#000', cream: '#eee' } as never;
    const stripped = {
      ...v1,
      palette,
      sourceReviewId: 'rev-1',
      scenes: v1.scenes.map((s) => ({ ...s, imageUrl: null, layers: [] as never[] })),
    };
    const out = migrateVideoProjectV1(stripped);
    expect(out.palette).toBe(palette);
    expect(out.sourceReviewId).toBe('rev-1');
    expect((mainTrackOf(out).items as MediaItem[]).every((i) => i.media.url === '')).toBe(true);
    expect(validateProject(out)).toEqual([]);
  });

  it('is deterministic for ids that identify scenes and layers', () => {
    const a = migrateVideoProjectV1(v1);
    const b = migrateVideoProjectV1(v1);
    expect(a).toEqual(b);
  });
});

describe('parseVideoProjectV2', () => {
  const v1 = buildDefaultVideoProject('quiet-morning', 'soft-stay', binding, 'instagram-story');
  const parse = (raw: unknown) =>
    parseVideoProjectV2(raw, 'quiet-morning', 'soft-stay', binding, 'instagram-story');

  it('upgrades v1, keeps palette/review ids that v1 parsing drops, and round-trips v2', () => {
    const upgraded = parse({ ...v1, palette: { accent: '#111' }, sourceReviewId: 'r1' });
    expect(upgraded.version).toBe(2);
    expect(upgraded.palette).toEqual({ accent: '#111' });
    expect(upgraded.sourceReviewId).toBe('r1');
    expect(parse(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded);
  });

  it('falls back to the default project for junk', () => {
    for (const junk of [
      null,
      undefined,
      'x',
      42,
      [],
      {},
      { version: 2 },
      { version: 2, tracks: [] },
      { version: 9 },
    ]) {
      const out = parse(junk);
      expect(out.version).toBe(2);
      expect(validateProject(out)).toEqual([]);
      expect(mainTrackOf(out).items.length).toBeGreaterThan(0);
    }
  });

  it('sanitizes hostile v2 input without throwing', () => {
    const out = parse({
      version: 2,
      templateId: 'quiet-morning',
      fps: 9999,
      background: { color: 'javascript:alert(1)', fill: 'weird' },
      tracks: [
        {
          id: 'main',
          kind: 'main',
          items: [
            {
              id: 'a',
              type: 'image',
              from: -50,
              durationInFrames: 600,
              media: { url: 5, source: 'evil' },
              fit: 'stretch',
              transform: { x: 'no', widthPct: 1e9, opacity: 7 },
            },
            {
              id: 'a',
              type: 'video',
              from: 0,
              durationInFrames: 60,
              media: { url: 'u' },
              playbackRate: 77,
            },
            null,
            { type: 'layer', layer: { kind: 'text' } },
            { type: 'mystery' },
          ],
        },
        {
          kind: 'text',
          items: [
            {
              id: 't',
              type: 'layer',
              from: 0,
              durationInFrames: 30,
              layer: { kind: 'background' },
            },
          ],
        },
        { kind: 'nope', items: [] },
        'x',
        { kind: 'audio', items: [{ type: 'audio', media: {}, from: 0, durationInFrames: 10 }] },
      ],
    });
    expect(validateProject(out)).toEqual([]);
    expect(out.fps).toBe(30);
    expect(out.background).toEqual({ color: '#0f172a', fill: 'color' });
    const [first, second] = mainTrackOf(out).items as never as Array<Record<string, unknown>>;
    expect(first!.fit).toBe('cover');
    expect((first!.media as { url: string }).url).toBe('');
    expect((first!.transform as { opacity: number }).opacity).toBe(1);
    expect(second!.playbackRate).toBeUndefined();
    expect(new Set(mainTrackOf(out).items.map((i) => i.id)).size).toBe(
      mainTrackOf(out).items.length
    );
    expect(out.tracks.flatMap((t) => t.items).some((i) => i.type === 'audio')).toBe(false);
  });

  it('merges extra main tracks, spreads overlaps and enforces caps', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `l${i}`,
      type: 'layer',
      from: 0,
      durationInFrames: 30,
      layer: { id: `x${i}`, kind: 'text', text: 'hi', position: { x: 50, y: 50 } },
    }));
    const out = parse({
      version: 2,
      tracks: [
        { kind: 'main', items: [{ type: 'image', durationInFrames: 60, media: { url: 'a' } }] },
        { kind: 'main', items: [{ type: 'image', durationInFrames: 60, media: { url: 'b' } }] },
        { kind: 'text', items },
      ],
    });
    expect(validateProject(out)).toEqual([]);
    expect(mainTrackOf(out).items).toHaveLength(2);
    expect(out.tracks.length).toBeLessThanOrEqual(10);
    expect(out.tracks.flatMap((t) => t.items).length).toBeLessThanOrEqual(150);
  });
});
