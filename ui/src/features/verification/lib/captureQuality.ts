/**
 * Capture quality scoring for the document frame.
 *
 * Pure functions only: the hook feeds them a downscaled grayscale buffer, so all of this
 * is unit-testable without a camera. Thresholds live in one object because the on-screen
 * guidance ("hold steady", "too much glare") and the auto-capture gate must agree.
 */

export type CaptureQualityThresholds = {
  /** Laplacian variance below this reads as blurry. */
  minBlurVariance: number;
  /** Share of near-white pixels above which glare is a problem. */
  maxGlareRatio: number;
  /** Mean Sobel magnitude below this means no document edge is in frame. */
  minEdgeDensity: number;
  /** Minimum weighted score for auto-capture. */
  minScore: number;
};

export const CAPTURE_QUALITY_THRESHOLDS: CaptureQualityThresholds = {
  minBlurVariance: 55,
  maxGlareRatio: 0.14,
  minEdgeDensity: 12,
  minScore: 0.55,
};

export type CaptureQualitySample = {
  blurVariance: number;
  glareRatio: number;
  edgeDensity: number;
};

export type CaptureQualityResult = {
  score: number;
  acceptable: boolean;
  /** Short, user-facing reason codes. Empty when acceptable. */
  issues: Array<'blurry' | 'glare' | 'no_document'>;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function scoreCapture(
  sample: CaptureQualitySample,
  thresholds: CaptureQualityThresholds = CAPTURE_QUALITY_THRESHOLDS
): CaptureQualityResult {
  const blurScore = clamp01(sample.blurVariance / (thresholds.minBlurVariance * 3));
  const glareScore = 1 - clamp01(sample.glareRatio / (thresholds.maxGlareRatio * 2));
  const edgeScore = clamp01(sample.edgeDensity / (thresholds.minEdgeDensity * 2));

  const score = clamp01(blurScore * 0.45 + glareScore * 0.2 + edgeScore * 0.35);

  const issues: CaptureQualityResult['issues'] = [];
  if (sample.blurVariance < thresholds.minBlurVariance) issues.push('blurry');
  if (sample.glareRatio > thresholds.maxGlareRatio) issues.push('glare');
  if (sample.edgeDensity < thresholds.minEdgeDensity) issues.push('no_document');

  return { score, acceptable: issues.length === 0 && score >= thresholds.minScore, issues };
}

/**
 * Mean of the squared Laplacian over a grayscale buffer. A flat or motion-blurred frame
 * has a low value; a crisp document edge has a high one.
 */
export function computeBlurVariance(
  gray: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3 || gray.length < width * height) return 0;

  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const center = gray[index] ?? 0;
      const laplacian =
        4 * center -
        (gray[index - 1] ?? 0) -
        (gray[index + 1] ?? 0) -
        (gray[index - width] ?? 0) -
        (gray[index + width] ?? 0);
      sum += laplacian * laplacian;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/** Share of pixels at or above 245 — a blown-out highlight, usually a phone flash or a window. */
export function computeGlareRatio(gray: Uint8ClampedArray | Uint8Array): number {
  if (gray.length === 0) return 0;
  let bright = 0;
  for (const value of gray) {
    if (value >= 245) bright += 1;
  }
  return bright / gray.length;
}

/** Mean Sobel magnitude. Near-zero means a blank frame with nothing to capture. */
export function computeEdgeDensity(
  gray: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3 || gray.length < width * height) return 0;

  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -1 * (gray[i - width - 1] ?? 0) +
        1 * (gray[i - width + 1] ?? 0) +
        -2 * (gray[i - 1] ?? 0) +
        2 * (gray[i + 1] ?? 0) +
        -1 * (gray[i + width - 1] ?? 0) +
        1 * (gray[i + width + 1] ?? 0);
      const gy =
        -1 * (gray[i - width - 1] ?? 0) +
        -2 * (gray[i - width] ?? 0) +
        -1 * (gray[i - width + 1] ?? 0) +
        1 * (gray[i + width - 1] ?? 0) +
        2 * (gray[i + width] ?? 0) +
        1 * (gray[i + width + 1] ?? 0);
      sum += Math.sqrt(gx * gx + gy * gy);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/** Grayscale conversion used by every sampler, so tests and runtime agree. */
export function toGrayscale(rgba: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const pixelCount = Math.floor(rgba.length / 4);
  const gray = new Uint8ClampedArray(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

export type CaptureQualityIssue = CaptureQualityResult['issues'][number];

export const CAPTURE_QUALITY_MESSAGES: Record<CaptureQualityIssue, string> = {
  blurry: 'Hold steady',
  glare: 'Reduce glare',
  no_document: 'Fit the ID in the frame',
};
