import { describe, expect, it } from 'vitest';

import { safeRedirect } from '@/features/guest/auth/lib/authRedirect';

const fallback = '/org';

describe('safeRedirect', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeRedirect('/org/acme/dashboard', fallback)).toBe('/org/acme/dashboard');
    expect(safeRedirect('/account/stays?tab=upcoming#top', fallback)).toBe(
      '/account/stays?tab=upcoming#top'
    );
  });

  it('falls back when missing or not a path', () => {
    expect(safeRedirect(null, fallback)).toBe(fallback);
    expect(safeRedirect('', fallback)).toBe(fallback);
    expect(safeRedirect('https://evil.example', fallback)).toBe(fallback);
    expect(safeRedirect('javascript:alert(1)', fallback)).toBe(fallback);
  });

  it('rejects protocol-relative and backslash open redirects', () => {
    for (const raw of [
      '//evil.example',
      '/\\evil.example',
      '/\\/evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/org\\..\\evil',
    ]) {
      expect(safeRedirect(raw, fallback)).toBe(fallback);
    }
  });

  it('every accepted value stays on the current origin', () => {
    const origin = 'https://app.example';
    for (const raw of ['/org', '/\\evil.example', '/\t/evil.example', '//evil.example']) {
      const target = safeRedirect(raw, fallback);
      expect(new URL(target, origin).origin).toBe(origin);
    }
  });
});
