import { describe, expect, it } from 'vitest';

import {
  jamendoStreamClips,
  remapAudioUrls,
} from '@/features/dashboard/marketing/lib/video/v2/exportAudio';
import { audioItems } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  photo,
  project,
  song,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const stream = 'https://prod-1.storage.jamendo.com/?trackid=1&format=mp31';

describe('exportAudio', () => {
  const a = song(0, 60, 30, { media: { url: stream, source: 'jamendo' } });
  const b = song(60, 60, 30, { media: { url: 'https://x/own.mp3', source: 'library' } });
  const p = project([track('main', [photo(150)]), track('audio', [a, b])]);

  it('finds only Jamendo stream clips', () => {
    expect(jamendoStreamClips(p).map((c) => c.id)).toEqual([a.id]);
  });

  it('swaps and drops clips by id', () => {
    const next = remapAudioUrls(p, new Map<string, string | null>([[a.id, 'https://cdn/a.mp3']]));
    expect(audioItems(next).find((c) => c.id === a.id)?.media.url).toBe('https://cdn/a.mp3');
    const dropped = remapAudioUrls(p, new Map<string, string | null>([[a.id, null]]));
    expect(audioItems(dropped).map((c) => c.id)).toEqual([b.id]);
  });

  it('returns the same project when nothing changes', () => {
    expect(remapAudioUrls(p, new Map())).toBe(p);
  });
});
