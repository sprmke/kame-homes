import type { PosterTypeRole } from '@/features/dashboard/marketing/lib/poster/posterFonts';

/**
 * Deterministic text fitting for poster slots. In the browser, widths come from a
 * canvas measurer using the real (preloaded) fonts; without one (unit tests, fonts
 * still loading) they fall back to each role's `widthFactor`. `fitPosterTextSlots`
 * is the last-resort correction after render.
 */

const SPACE_FACTOR = 0.3;

/** Real glyph measurement, registered in the browser once poster fonts are loaded. */
export type PosterTextMeasurer = (
  value: string,
  role: PosterTypeRole,
  fontSize: number
) => number | null;

let measurer: PosterTextMeasurer | null = null;

export function setPosterTextMeasurer(next: PosterTextMeasurer | null): void {
  measurer = next;
}

export function estimateTextWidth(value: string, role: PosterTypeRole, fontSize: number): number {
  const measured = measurer?.(value, role, fontSize);
  if (typeof measured === 'number' && Number.isFinite(measured)) return measured;
  const chars = [...value];
  if (chars.length === 0) return 0;
  let units = 0;
  for (const char of chars) units += char === ' ' ? SPACE_FACTOR : role.widthFactor;
  const tracking = role.letterSpacing * Math.max(0, chars.length - 1);
  return (units + tracking) * fontSize;
}

function greedyWrap(words: string[], role: PosterTypeRole, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || estimateTextWidth(candidate, role, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wraps to the same number of lines greedy wrapping needs, but at the narrowest
 * width that still achieves it — so a 2-line headline splits evenly instead of
 * leaving one word alone on line two.
 */
export function wrapBalanced(
  value: string,
  role: PosterTypeRole,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const greedy = greedyWrap(words, role, fontSize, maxWidth);
  if (greedy.length <= 1) return greedy;
  let low = 0;
  let high = maxWidth;
  let best = greedy;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    const attempt = greedyWrap(words, role, fontSize, mid);
    if (attempt.length <= greedy.length) {
      best = attempt;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

export type FittedText = {
  fontSize: number;
  lines: string[];
  /** Widest estimated line, px. */
  width: number;
  height: number;
  /** True when even `minFontSize` could not satisfy the box. */
  overflow: boolean;
};

export type FitTextOptions = {
  maxWidth: number;
  maxFontSize: number;
  minFontSize: number;
  maxLines: number;
  maxHeight?: number;
};

function measure(value: string, role: PosterTypeRole, fontSize: number, maxWidth: number) {
  const lines = wrapBalanced(value, role, fontSize, maxWidth);
  const width = Math.max(0, ...lines.map((line) => estimateTextWidth(line, role, fontSize)));
  const height = lines.length * fontSize * role.lineHeight;
  return { lines, width, height };
}

/** Largest font size (stepping down ~3%) whose balanced wrap fits the box. */
export function fitText(value: string, role: PosterTypeRole, options: FitTextOptions): FittedText {
  const clean = value.replace(/\s+/g, ' ').trim();
  const minFontSize = Math.max(1, Math.min(options.minFontSize, options.maxFontSize));
  let fontSize = Math.max(minFontSize, options.maxFontSize);
  while (fontSize >= minFontSize) {
    const result = measure(clean, role, fontSize, options.maxWidth);
    const fits =
      result.lines.length <= options.maxLines &&
      result.width <= options.maxWidth &&
      (options.maxHeight === undefined || result.height <= options.maxHeight);
    if (fits) return { fontSize: Math.round(fontSize), ...result, overflow: false };
    const next = Math.floor(fontSize * 0.97);
    if (next === fontSize) break;
    fontSize = next;
  }
  const result = measure(clean, role, minFontSize, options.maxWidth);
  return { fontSize: Math.round(minFontSize), ...result, overflow: true };
}
