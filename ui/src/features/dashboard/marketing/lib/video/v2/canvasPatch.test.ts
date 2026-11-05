import { describe, expect, it } from 'vitest';

import { applyCanvasPatch } from '@/features/dashboard/marketing/lib/video/v2/canvasPatch';
import { findItem } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  isLayerItem,
  isMediaItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  caption,
  photo,
  project,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

describe('applyCanvasPatch', () => {
  const text = caption(0, 60);
  const overlay = photo(60, { transform: { x: 50, y: 50, widthPct: 60, rotation: 0, opacity: 1 } });
  const p = project([
    track('main', [photo(90)]),
    track('overlay', [overlay]),
    track('text', [text]),
  ]);

  it('moves a text layer', () => {
    const next = applyCanvasPatch(p, {
      kind: 'layer-position',
      itemId: text.id,
      position: { x: 20, y: 30 },
    });
    const item = findItem(next, text.id)!.item;
    expect(isLayerItem(item) && item.layer.position).toEqual({ x: 20, y: 30 });
  });

  it('resizes a text layer', () => {
    const next = applyCanvasPatch(p, { kind: 'layer-width', itemId: text.id, widthPct: 55 });
    const item = findItem(next, text.id)!.item;
    expect(isLayerItem(item) && item.layer.widthPct).toBe(55);
  });

  it('merges a partial transform into an overlay clip', () => {
    const next = applyCanvasPatch(p, {
      kind: 'transform',
      itemId: overlay.id,
      transform: { rotation: 15, x: 10 },
    });
    const item = findItem(next, overlay.id)!.item;
    expect(isMediaItem(item) && item.transform).toEqual({
      x: 10,
      y: 50,
      widthPct: 60,
      rotation: 15,
      opacity: 1,
    });
  });

  it('returns the same project for a missing item or the wrong kind', () => {
    expect(applyCanvasPatch(p, { kind: 'layer-width', itemId: 'nope', widthPct: 5 })).toBe(p);
    expect(applyCanvasPatch(p, { kind: 'layer-width', itemId: overlay.id, widthPct: 5 })).toEqual(
      p
    );
  });
});
