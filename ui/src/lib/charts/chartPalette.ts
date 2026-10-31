import { STATUS_TONE_HEX } from '@/lib/statusToneColors';

/** Distinct segment colors for pie / breakdown charts — tone-aligned first, then extras. */
const CHART_SEGMENT_PALETTE = [
  STATUS_TONE_HEX.green,
  STATUS_TONE_HEX.blue,
  STATUS_TONE_HEX.orange,
  STATUS_TONE_HEX.purple,
  STATUS_TONE_HEX.amber,
  '#6366f1',
  STATUS_TONE_HEX.red,
  '#ec4899',
  '#84cc16',
  '#06b6d4',
  STATUS_TONE_HEX.yellow,
  '#d946ef',
  STATUS_TONE_HEX.neutral,
  '#22c55e',
  '#f43f5e',
  '#a855f7',
  '#0ea5e9',
  '#14b8a6',
] as const;

function normalizeColorKey(color: string): string {
  return color.trim().toLowerCase();
}

function hslChartColor(seed: number): string {
  const hue = (seed * 137.508) % 360;
  return `hsl(${Math.round(hue)} 62% 48%)`;
}

/**
 * Assign one color per category for a single chart render.
 * Prefers semantic colors first, then falls back to the palette / generated hues.
 */
export function assignUniqueChartColors(
  categories: string[],
  preferColor: (category: string, index: number) => string
): string[] {
  const used = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i]!;
    const candidates: string[] = [preferColor(category, i), ...CHART_SEGMENT_PALETTE];

    for (let j = 0; j < 12; j++) {
      candidates.push(hslChartColor(i * 12 + j));
    }

    let assigned = candidates[0]!;
    for (const candidate of candidates) {
      const key = normalizeColorKey(candidate);
      if (!used.has(key)) {
        assigned = candidate;
        break;
      }
    }

    used.add(normalizeColorKey(assigned));
    result.push(assigned);
  }

  return result;
}
