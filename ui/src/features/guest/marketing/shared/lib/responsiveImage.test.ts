import { describe, expect, it } from 'vitest';

import { buildResponsiveImage } from '@/features/guest/marketing/shared/lib/responsiveImage';

const STORAGE =
  'https://abc.supabase.co/storage/v1/object/public/property-media/p1/photo%201.jpg';

describe('buildResponsiveImage', () => {
  it('uses the Storage render endpoint only when transforms are enabled', () => {
    expect(buildResponsiveImage(STORAGE, { storageTransforms: false })).toBeNull();
    const out = buildResponsiveImage(STORAGE, { storageTransforms: true, widths: [320, 640] });
    expect(out?.src).toContain('/storage/v1/render/image/public/property-media/p1/photo%201.jpg');
    expect(out?.src).toContain('width=640');
    expect(out?.srcSet).toContain('width=320');
    expect(out?.srcSet).toMatch(/ 320w, .* 640w$/);
  });

  it('rewrites the Unsplash w= param', () => {
    const out = buildResponsiveImage('https://images.unsplash.com/photo-1?w=1600&q=80', {
      storageTransforms: false,
      widths: [480],
    });
    expect(out).toEqual({
      src: 'https://images.unsplash.com/photo-1?w=480&q=80',
      srcSet: 'https://images.unsplash.com/photo-1?w=480&q=80 480w',
    });
  });

  it('leaves other hosts, data URLs, and garbage alone', () => {
    expect(buildResponsiveImage('https://cdn.example.com/a.jpg', { storageTransforms: true })).toBeNull();
    expect(buildResponsiveImage('data:image/png;base64,AAAA', { storageTransforms: true })).toBeNull();
    expect(buildResponsiveImage('/images/local.jpg', { storageTransforms: true })).toBeNull();
    expect(buildResponsiveImage('', { storageTransforms: true })).toBeNull();
  });
});
