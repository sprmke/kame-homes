import { describe, expect, it, vi } from 'vitest';

import { shareContent, canWebShare } from '@/lib/pwa/share';

describe('canWebShare', () => {
  it('reflects navigator.share', () => {
    vi.stubGlobal('navigator', { share: () => {} });
    expect(canWebShare()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(canWebShare()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('shareContent', () => {
  it('uses the native share sheet when available', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { share });
    await expect(shareContent({ title: 'Monaco 2604', url: 'https://x.test/p/1' })).resolves.toBe(
      'shared'
    );
    expect(share).toHaveBeenCalledWith({ title: 'Monaco 2604', url: 'https://x.test/p/1' });
    vi.unstubAllGlobals();
  });

  it('treats a user cancel as cancelled, not a failure', async () => {
    vi.stubGlobal('navigator', {
      share: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    });
    await expect(shareContent({ url: 'https://x.test/p/1' })).resolves.toBe('cancelled');
    vi.unstubAllGlobals();
  });

  it('falls back to the clipboard when share throws for another reason', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', {
      share: async () => {
        throw new Error('nope');
      },
      clipboard: { writeText },
    });
    await expect(shareContent({ url: 'https://x.test/p/1' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x.test/p/1');
    vi.unstubAllGlobals();
  });

  it('reports unavailable when neither path exists', async () => {
    vi.stubGlobal('navigator', {});
    await expect(shareContent({ url: 'https://x.test/p/1' })).resolves.toBe('unavailable');
    vi.unstubAllGlobals();
  });

  it('omits fields that were not provided', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { share });
    await shareContent({ title: 'Only a title' });
    expect(share).toHaveBeenCalledWith({ title: 'Only a title' });
    vi.unstubAllGlobals();
  });
});
