/** Test builders for v2 projects. Not imported by app code. */

import {
  DEFAULT_PROJECT_BACKGROUND,
  DEFAULT_VISUAL_TRANSFORM,
  VIDEO_V2_FPS,
  type AudioItem,
  type LayerItem,
  type MediaItem,
  type VideoItem,
  type VideoProjectV2,
  type VideoTrack,
  type VideoTrackKind,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

let counter = 0;
const uid = (prefix: string) => `${prefix}${(counter += 1)}`;

export function photo(durationInFrames = 90, extra: Partial<MediaItem> = {}): MediaItem {
  return {
    id: uid('img'),
    type: 'image',
    from: 0,
    durationInFrames,
    media: { url: 'https://example.test/p.jpg', source: 'property' },
    fit: 'cover',
    transform: { ...DEFAULT_VISUAL_TRANSFORM },
    ...extra,
  };
}

export function clip(
  durationInFrames = 90,
  sourceSeconds = 10,
  extra: Partial<MediaItem> = {}
): MediaItem {
  return {
    id: uid('vid'),
    type: 'video',
    from: 0,
    durationInFrames,
    media: {
      url: 'https://example.test/v.mp4',
      source: 'library',
      durationMs: sourceSeconds * 1000,
    },
    fit: 'cover',
    transform: { ...DEFAULT_VISUAL_TRANSFORM },
    trimBeforeFrames: 0,
    volume: 1,
    ...extra,
  };
}

export function caption(from = 0, durationInFrames = 60, text = 'Hello'): LayerItem {
  return {
    id: uid('txt'),
    type: 'layer',
    from,
    durationInFrames,
    layer: { id: uid('layer'), kind: 'text', text, position: { x: 50, y: 50 } },
  };
}

export function song(
  from = 0,
  durationInFrames = 120,
  sourceSeconds = 30,
  extra: Partial<AudioItem> = {}
): AudioItem {
  return {
    id: uid('aud'),
    type: 'audio',
    from,
    durationInFrames,
    media: {
      url: 'https://example.test/a.mp3',
      source: 'library',
      durationMs: sourceSeconds * 1000,
    },
    volume: 0.5,
    ...extra,
  };
}

export function track(
  kind: VideoTrackKind,
  items: VideoItem[] = [],
  extra: Partial<VideoTrack> = {}
) {
  return { id: uid('trk'), kind, items, ...extra } as VideoTrack;
}

export function project(
  tracks: VideoTrack[] = [track('main')],
  extra: Partial<VideoProjectV2> = {}
): VideoProjectV2 {
  return {
    version: 2,
    templateId: 'quiet-morning',
    campaignCategory: 'soft-stay',
    format: 'instagram-story',
    fps: VIDEO_V2_FPS,
    background: { ...DEFAULT_PROJECT_BACKGROUND },
    tracks,
    ...extra,
  };
}
