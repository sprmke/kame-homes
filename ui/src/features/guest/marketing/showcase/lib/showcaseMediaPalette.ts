import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import {
  clampChannel,
  hslToHex,
  rgbToHsl as rgbChannelsToHsl,
  type Hsl,
  type Rgb,
} from '@/lib/theme/colorConvert';

type ColorBucket = { h: number; s: number; l: number; weight: number };

type WarmNeutralBucket = ColorBucket & { pixelCount: number };

type ImageSample = {
  accentBuckets: ColorBucket[];
  warmNeutrals: WarmNeutralBucket[];
  /** Mean relative luminance across sampled opaque pixels (0–1). */
  meanLuminance: number;
  warmNeutralShare: number;
};

export type ShowcaseMediaPalette = {
  accentHexLight: string;
  accentHexDark: string;
  surfaceHslLight: string;
  surfaceHslDark: string;
  /** True when the dominant hue reads warm (amber / terracotta / sand). */
  warmHue: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return clampChannel(value, min, max);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  return rgbChannelsToHsl(r, g, b);
}

function chromaRatio(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) / (max || 1);
}

function isPureWhite(r: number, g: number, b: number): boolean {
  return Math.max(r, g, b) > 245 && Math.min(r, g, b) > 230;
}

function isPureBlack(r: number, g: number, b: number): boolean {
  return Math.max(r, g, b) < 24;
}

function isWarmHue(h: number): boolean {
  return h >= 16 && h <= 62;
}

function isCoolAccentHue(h: number): boolean {
  return (h >= 78 && h <= 168) || (h >= 185 && h <= 255);
}

function isWarmNeutral(hsl: Hsl): boolean {
  if (!isWarmHue(hsl.h)) return false;
  if (hsl.l < 34 || hsl.l > 96) return false;
  return hsl.s <= 42 || chromaRatioFromHsl(hsl) < 0.22;
}

function chromaRatioFromHsl(hsl: Hsl): number {
  const l = hsl.l / 100;
  if (hsl.s === 0) return 0;
  const c = (hsl.s / 100) * (1 - Math.abs(2 * l - 1));
  const max = l + c / 2;
  return c / (max || 1);
}

function isAccentPixel(hsl: Hsl, r: number, g: number, b: number): boolean {
  if (isPureWhite(r, g, b) || isPureBlack(r, g, b)) return false;
  if (hsl.l < 10 || hsl.l > 88) return false;
  if (hsl.s < 14) return false;
  return chromaRatio(r, g, b) >= 0.12;
}

function upsertBucket(map: Map<string, ColorBucket>, key: string, hsl: Hsl, weight: number): void {
  const existing = map.get(key);
  if (existing) {
    existing.weight += weight;
    existing.h = existing.h * 0.72 + hsl.h * 0.28;
    existing.s = existing.s * 0.72 + hsl.s * 0.28;
    existing.l = existing.l * 0.72 + hsl.l * 0.28;
  } else {
    map.set(key, { h: hsl.h, s: hsl.s, l: hsl.l, weight });
  }
}

function sampleImage(data: ImageData): ImageSample {
  const accentMap = new Map<string, ColorBucket>();
  const warmMap = new Map<string, WarmNeutralBucket>();

  let luminanceSum = 0;
  let luminanceCount = 0;
  let warmNeutralPixels = 0;
  let sampledPixels = 0;

  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]!;
    const g = data.data[i + 1]!;
    const b = data.data[i + 2]!;
    const a = data.data[i + 3]!;
    if (a < 140) continue;

    sampledPixels += 1;
    const rgb = { r, g, b };
    const hsl = rgbToHsl(rgb);
    const lum = relativeLuminance(rgb);

    if (!isPureWhite(r, g, b) && !isPureBlack(r, g, b)) {
      luminanceSum += lum;
      luminanceCount += 1;
    } else if (isPureWhite(r, g, b)) {
      luminanceSum += 0.94;
      luminanceCount += 1;
    }

    if (isWarmNeutral(hsl)) {
      warmNeutralPixels += 1;
      const hBin = Math.round(hsl.h / 12) * 12;
      const lBin = Math.round(hsl.l / 8) * 8;
      const key = `${hBin}-${lBin}`;
      const weight = 0.55 + hsl.l / 120;
      const existing = warmMap.get(key);
      if (existing) {
        existing.weight += weight;
        existing.pixelCount += 1;
        existing.h = existing.h * 0.8 + hsl.h * 0.2;
        existing.s = existing.s * 0.8 + hsl.s * 0.2;
        existing.l = existing.l * 0.8 + hsl.l * 0.2;
      } else {
        warmMap.set(key, { h: hsl.h, s: hsl.s, l: hsl.l, weight, pixelCount: 1 });
      }
    }

    if (isAccentPixel(hsl, r, g, b)) {
      const hBin = Math.round(hsl.h / 18) * 18;
      const sBin = Math.round(hsl.s / 12) * 12;
      const lBin = Math.round(hsl.l / 12) * 12;
      const key = `${hBin}-${sBin}-${lBin}`;
      const midToneBoost = 1 - Math.abs(hsl.l - 46) / 46;
      const warmBoost = isWarmHue(hsl.h) ? 1.35 : isCoolAccentHue(hsl.h) ? 0.72 : 1;
      const weight = (hsl.s / 100) * (0.4 + 0.6 * midToneBoost) * warmBoost;
      upsertBucket(accentMap, key, hsl, weight);
    }
  }

  return {
    accentBuckets: [...accentMap.values()],
    warmNeutrals: [...warmMap.values()],
    meanLuminance: luminanceCount > 0 ? luminanceSum / luminanceCount : 0.58,
    warmNeutralShare: sampledPixels > 0 ? warmNeutralPixels / sampledPixels : 0,
  };
}

async function loadImageData(url: string): Promise<ImageData | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      try {
        resolve(ctx.getImageData(0, 0, size, size));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function mergeAccentBuckets(all: ColorBucket[]): ColorBucket[] {
  const merged = new Map<string, ColorBucket & { count: number }>();
  for (const bucket of all) {
    const hBin = Math.round(bucket.h / 20) * 20;
    const key = `${hBin}`;
    const existing = merged.get(key);
    if (existing) {
      const nextCount = existing.count + 1;
      existing.h = (existing.h * existing.count + bucket.h) / nextCount;
      existing.s = (existing.s * existing.count + bucket.s) / nextCount;
      existing.l = (existing.l * existing.count + bucket.l) / nextCount;
      existing.weight += bucket.weight;
      existing.count = nextCount;
    } else {
      merged.set(key, { ...bucket, count: 1 });
    }
  }

  return [...merged.values()].sort((a, b) => {
    const score = (bucket: ColorBucket) => {
      let s = bucket.weight;
      if (isWarmHue(bucket.h)) s *= 1.45;
      if (isCoolAccentHue(bucket.h)) s *= 0.55;
      if (bucket.l >= 22 && bucket.l <= 68) s *= 1.15;
      return s;
    };
    return score(b) - score(a);
  });
}

function pickDominantWarmNeutral(buckets: WarmNeutralBucket[]): WarmNeutralBucket | null {
  if (buckets.length === 0) return null;
  return [...buckets].sort((a, b) => {
    const score = (bucket: WarmNeutralBucket) =>
      bucket.weight * (0.6 + bucket.pixelCount * 0.08) * (0.7 + bucket.l / 140);
    return score(b) - score(a);
  })[0]!;
}

function buildSurfacePair(
  surfaceNeutral: WarmNeutralBucket | null,
  accent: ColorBucket
): { light: string; dark: string } {
  const hue = Math.round(surfaceNeutral?.h ?? accent.h);
  const fromPhoto = surfaceNeutral?.l ?? 88;
  const lightL = clamp(fromPhoto + 4, 93, 98);
  const lightS = clamp((surfaceNeutral?.s ?? 16) * 0.55, 8, 24);
  const darkBase = surfaceNeutral?.l ?? 14;
  const darkL = clamp(Math.max(darkBase * 0.42, 10), 10, 18);
  const darkS = clamp((surfaceNeutral?.s ?? accent.s) * 0.42, 10, 22);
  return {
    light: `${hue} ${Math.round(lightS)}% ${Math.round(lightL)}%`,
    dark: `${hue} ${Math.round(darkS)}% ${Math.round(darkL)}%`,
  };
}

function buildAccentPair(
  accentCandidate: ColorBucket,
  surfaceNeutral: WarmNeutralBucket | null
): {
  light: string;
  dark: string;
} {
  const accentS = clamp(
    Math.max(accentCandidate.s, surfaceNeutral?.s ? surfaceNeutral.s * 1.4 : accentCandidate.s) *
      1.05,
    32,
    68
  );
  const lightL = clamp(accentCandidate.l - 2, 36, 48);
  const darkL = clamp(accentCandidate.l + 6, 46, 58);
  return {
    light: hslToHex(accentCandidate.h, accentS, lightL),
    dark: hslToHex(accentCandidate.h, accentS, darkL),
  };
}

/** Image URLs used for palette extraction — hero/gallery slots first, then any section images. */
export function collectShowcaseMediaUrls(data: ShowcaseData): string[] {
  const prioritized: string[] = [];
  const hero = data.sections.find((section) => section.id === 'hero');
  const gallery = data.sections.find((section) => section.id === 'gallery');
  if (hero?.images.length) prioritized.push(...hero.images);
  if (gallery?.images.length) prioritized.push(...gallery.images);
  for (const section of data.sections) {
    if (section.id === 'hero' || section.id === 'gallery') continue;
    prioritized.push(...section.images);
  }
  return [...new Set(prioritized.filter(Boolean))].slice(0, 10);
}

/**
 * Sample property photos and build light + dark accent/surface pairs.
 * Theme toggle picks the pair; cream/beige backgrounds map to cream light and darker cream dark.
 */
export async function generateShowcaseMediaPalette(
  urls: string[]
): Promise<ShowcaseMediaPalette | null> {
  const unique = [...new Set(urls.filter(Boolean))].slice(0, 10);
  if (unique.length === 0) return null;

  const imageSets = await Promise.all(unique.map((url) => loadImageData(url)));
  const samples: ImageSample[] = [];

  for (const imageData of imageSets) {
    if (!imageData) continue;
    samples.push(sampleImage(imageData));
  }

  if (samples.length === 0) return null;

  const allAccents = samples.flatMap((sample) => sample.accentBuckets);
  const allWarmNeutrals = samples.flatMap((sample) => sample.warmNeutrals);
  const surfaceNeutral = pickDominantWarmNeutral(allWarmNeutrals);

  const rankedAccents = mergeAccentBuckets(allAccents);
  const accentCandidate =
    rankedAccents.find((bucket) => bucket.s >= 16 && bucket.l >= 18 && bucket.l <= 72) ??
    rankedAccents[0] ??
    (surfaceNeutral
      ? { h: surfaceNeutral.h, s: clamp(surfaceNeutral.s * 1.6, 28, 58), l: 42, weight: 1 }
      : null);

  if (!accentCandidate) return null;

  const warmHue = isWarmHue(accentCandidate.h) || Boolean(surfaceNeutral);
  const accents = buildAccentPair(accentCandidate, surfaceNeutral);
  const surfaces = buildSurfacePair(surfaceNeutral, accentCandidate);

  return {
    accentHexLight: accents.light,
    accentHexDark: accents.dark,
    surfaceHslLight: surfaces.light,
    surfaceHslDark: surfaces.dark,
    warmHue,
  };
}
