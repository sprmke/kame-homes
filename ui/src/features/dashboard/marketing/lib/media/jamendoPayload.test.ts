import { describe, expect, it } from 'vitest';

import { payloadFromTrack } from '@/features/dashboard/marketing/lib/media/jamendoPayload';

describe('payloadFromTrack', () => {
  it('turns a track into an audio clip payload with its credit', () => {
    expect(
      payloadFromTrack({
        id: '42',
        title: 'Lofi',
        artist: 'Joystock',
        durationSec: 93.4,
        imageUrl: null,
        streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=42',
        downloadUrl: '',
      })
    ).toMatchObject({
      kind: 'audio',
      source: 'jamendo',
      assetId: null,
      durationMs: 93_400,
      title: 'Lofi',
      artist: 'Joystock',
      trackId: '42',
    });
  });

  it('leaves the length open when the track reports none', () => {
    const payload = payloadFromTrack({
      id: '1',
      title: 't',
      artist: 'a',
      durationSec: 0,
      imageUrl: null,
      streamUrl: 'https://x/s',
      downloadUrl: '',
    });
    expect(payload.durationMs).toBeNull();
  });
});
