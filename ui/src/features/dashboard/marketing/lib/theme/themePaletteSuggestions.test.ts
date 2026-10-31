import { describe, expect, it } from 'vitest';

import {
  colorDistance,
  colorShades,
  distinctPalettes,
  roleColorSuggestions,
  samePalette,
  type ThemePalette,
} from '@/features/dashboard/marketing/lib/theme/themePaletteSuggestions';

const base: ThemePalette = {
  primary: '#2a9d8f',
  secondary: '#dff3ef',
  accent: '#e76f51',
  surface: '#f7fbfa',
  ink: '#16324a',
};

describe('palette suggestions', () => {
  it('drops palettes that look alike and keeps order', () => {
    const nearTwin = { ...base, primary: '#2b9e90', accent: '#e6704f' };
    const other = { ...base, primary: '#7c5cff', accent: '#ffcf5c' };
    const picked = distinctPalettes(
      [
        { key: 'a', label: 'A', palette: base },
        { key: 'b', label: 'B', palette: nearTwin },
        { key: 'c', label: 'C', palette: other },
      ],
      8
    );
    expect(picked.map((p) => p.key)).toEqual(['a', 'c']);
    expect(
      distinctPalettes(
        [
          { key: 'a', label: 'A', palette: base },
          { key: 'c', label: 'C', palette: other },
        ],
        1
      )
    ).toHaveLength(1);
  });

  it('compares palettes case-insensitively', () => {
    expect(samePalette(base, { ...base, primary: '#2A9D8F' })).toBe(true);
    expect(samePalette(base, { ...base, ink: '#000000' })).toBe(false);
  });

  it('shades go from lighter to darker around the color', () => {
    const shades = colorShades('#2A9D8F');
    expect(shades).toHaveLength(5);
    expect(shades[2]).toBe('#2a9d8f');
    expect(colorDistance(shades[0]!, '#ffffff')).toBeLessThan(colorDistance(shades[1]!, '#ffffff'));
    expect(colorDistance(shades[4]!, '#000000')).toBeLessThan(colorDistance(shades[3]!, '#000000'));
  });

  it('role suggestions are unique, distinct and capped', () => {
    const palettes = [base, { ...base, primary: '#2b9d8f' }, { ...base, primary: '#7c5cff' }];
    expect(roleColorSuggestions('primary', palettes)).toEqual(['#2a9d8f', '#7c5cff']);
    expect(roleColorSuggestions('primary', palettes, 1)).toHaveLength(1);
  });
});
