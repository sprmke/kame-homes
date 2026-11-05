import { describe, expect, it } from 'vitest';

import { buildWebAppManifest, LAUNCH_START_URL } from '@/pwa/manifest';

const manifest = buildWebAppManifest('Kame Space');

describe('web app manifest', () => {
  it('never changes the app identity', () => {
    // A new `id` orphans every existing install (see manifest.ts header).
    expect(manifest.id).toBe('/?app');
  });

  it('launches the resolver, not the public marketplace', () => {
    expect(manifest.start_url).toBe(LAUNCH_START_URL);
    expect(manifest.start_url.startsWith('/app')).toBe(true);
    expect(manifest.scope).toBe('/');
  });

  it('routes every shortcut through the resolver', () => {
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([
      '/app?shortcut=bookings',
      '/app?shortcut=inbox',
      '/app?shortcut=checkins',
    ]);
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.icons[0]?.sizes).toBe('96x96');
      expect(shortcut.icons[0]?.src).toMatch(/^\/icons\/shortcut-/);
    }
  });

  it('does not lock the app to portrait', () => {
    expect(manifest).not.toHaveProperty('orientation');
  });

  it('has the icons an install prompt requires', () => {
    const purposes = manifest.icons.map((icon) => icon.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
    expect(purposes).toContain('monochrome');
    expect(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any')).toBe(
      true
    );
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(
      true
    );
  });

  it('has screenshots for the rich install dialog', () => {
    const narrow = manifest.screenshots.filter((shot) => shot.form_factor === 'narrow');
    const wide = manifest.screenshots.filter((shot) => shot.form_factor === 'wide');
    expect(narrow.length).toBeGreaterThanOrEqual(2);
    expect(narrow.length).toBeLessThanOrEqual(4);
    expect(wide.length).toBeGreaterThanOrEqual(1);
    for (const shot of narrow) expect(shot.sizes).toBe('1080x1920');
  });

  it('uses one product name everywhere', () => {
    expect(manifest.name).toBe('Kame Space');
    expect(manifest.short_name).toBe('Kame Space');
    expect(manifest.name).not.toMatch(/kame homes/i);
  });

  it('keeps a stable snapshot', () => {
    expect(manifest).toMatchSnapshot();
  });
});
