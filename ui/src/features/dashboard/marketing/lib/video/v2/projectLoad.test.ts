import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  buildDefaultProjectV2,
  loadProjectV2,
  MUSIC_ITEM_ID,
  withResolvedMusic,
} from '@/features/dashboard/marketing/lib/video/v2/projectLoad';
import { validateProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import { audioItems } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';

const binding: DesignBinding = {
  propertyName: 'Casa',
  propertyPhoto: 'https://x/p.jpg',
  propertyMedia: [{ url: 'https://x/p.jpg', type: 'image' }],
  nightlyRate: '₱2,799 / night',
  availabilityText: '',
  monthLabel: 'June 2026',
  monthShort: 'June',
  openSlots: [],
};

describe('projectLoad', () => {
  it('builds a default project with the default track pending', () => {
    const { project, pendingMusic } = buildDefaultProjectV2(
      'quiet-morning',
      'soft-stay',
      binding,
      'instagram-story'
    );
    expect(project.version).toBe(2);
    expect(audioItems(project)).toHaveLength(0);
    expect(pendingMusic).toBeTruthy();
    expect(validateProject(project)).toEqual([]);
  });

  it('loads a saved v1 row and keeps its pending cue', () => {
    const v1 = buildDefaultVideoProject('quiet-morning', 'soft-stay', binding, 'instagram-story');
    const loaded = loadProjectV2(v1, 'quiet-morning', 'soft-stay', binding, 'instagram-story');
    expect(loaded.project.version).toBe(2);
    expect(loaded.pendingMusic).toBeTruthy();
  });

  it('loads a saved v2 row with no pending cue', () => {
    const { project } = buildDefaultProjectV2(
      'quiet-morning',
      'soft-stay',
      binding,
      'instagram-story'
    );
    const loaded = loadProjectV2(project, 'quiet-morning', 'soft-stay', binding, 'instagram-story');
    expect(loaded.pendingMusic).toBeUndefined();
    expect(loaded.project.tracks.length).toBe(project.tracks.length);
  });

  it('adds the resolved track as a looping clip, then updates it in place', () => {
    const { project } = buildDefaultProjectV2(
      'quiet-morning',
      'soft-stay',
      binding,
      'instagram-story'
    );
    const added = withResolvedMusic(project, {
      url: 'https://x/song.mp3',
      volume: 0.4,
      title: 'Song',
      artist: 'Band',
      source: 'jamendo',
      trackId: '9',
    });
    const [clip] = audioItems(added);
    expect(clip).toMatchObject({ id: MUSIC_ITEM_ID, loop: true, from: 0, volume: 0.4 });
    expect(validateProject(added)).toEqual([]);

    const cached = withResolvedMusic(
      {
        ...added,
        tracks: added.tracks.map((t) =>
          t.kind === 'audio'
            ? { ...t, items: t.items.map((i) => ({ ...i, volume: 0.9 }) as typeof i) }
            : t
        ),
      },
      { url: 'https://cdn/song.mp3', volume: 0.4, source: 'jamendo', trackId: '9' }
    );
    expect(audioItems(cached)).toHaveLength(1);
    expect(audioItems(cached)[0]).toMatchObject({
      media: { url: 'https://cdn/song.mp3' },
      volume: 0.9,
    });
  });

  it('ignores a track without a file', () => {
    const { project } = buildDefaultProjectV2(
      'quiet-morning',
      'soft-stay',
      binding,
      'instagram-story'
    );
    expect(withResolvedMusic(project, { url: null, volume: 0.4 })).toBe(project);
    expect(withResolvedMusic(project, undefined)).toBe(project);
  });
});

describe('withResolvedMusic addIfMissing', () => {
  it('does not bring back a clip the host removed', () => {
    const { project } = buildDefaultProjectV2(
      'quiet-morning',
      'soft-stay',
      binding,
      'instagram-story'
    );
    const cue = {
      url: 'https://cdn/song.mp3',
      volume: 0.4,
      source: 'jamendo' as const,
      trackId: '9',
    };
    expect(withResolvedMusic(project, cue, { addIfMissing: false })).toBe(project);
    expect(audioItems(withResolvedMusic(project, cue))).toHaveLength(1);
  });
});
