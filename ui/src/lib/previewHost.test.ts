import { describe, expect, it } from 'vitest';

import { isPreviewHost, isProductionWebHost } from '@/lib/previewHost';

describe('isPreviewHost', () => {
  it('treats dev subdomains and Vercel previews as preview', () => {
    expect(isPreviewHost('dev.kamespace.com')).toBe(true);
    expect(isPreviewHost('dev.kamespace.com')).toBe(true);
    expect(isPreviewHost('kame-homes-git-feature.vercel.app')).toBe(true);
  });

  it('does not treat production apex as preview', () => {
    expect(isPreviewHost('kamespace.com')).toBe(false);
    expect(isPreviewHost('www.kamespace.com')).toBe(false);
    expect(isPreviewHost('kamehomes.space')).toBe(false);
  });
});

describe('isProductionWebHost', () => {
  it('recognizes prod marketing hosts', () => {
    expect(isProductionWebHost('kamespace.com')).toBe(true);
    expect(isProductionWebHost('www.kamespace.com')).toBe(true);
  });
});
