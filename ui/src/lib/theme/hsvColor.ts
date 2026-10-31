import { resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { clampChannel, parseHexRgb as parseHexRgbRaw } from '@/lib/theme/colorConvert';

export type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number): number {
  return clampChannel(value, min, max);
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  return parseHexRgbRaw(resolveOrgBrandHex(hex));
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s: s * 100, v: v * 100 };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHsv(hex: string): Hsv {
  const rgb = parseHexRgb(hex);
  if (!rgb) return { h: 168, s: 65, v: 40 };
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export function normalizePickerHex(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed && /^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  return resolveOrgBrandHex(fallback).toLowerCase();
}
