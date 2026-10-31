export type FormatOrientation = 'portrait' | 'square' | 'landscape';

export type MarketingFormatMeta = {
  width: number;
  height: number;
  orientation: FormatOrientation;
  aspectLabel: string;
  resolutionLabel: string;
  orientationLabel: string;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = y;
    y = x % y;
    x = next;
  }
  return x || 1;
}

function aspectLabel(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export function marketingFormatMeta(width: number, height: number): MarketingFormatMeta {
  const ratio = width / height;
  let orientation: FormatOrientation;
  let orientationLabel: string;

  if (Math.abs(ratio - 1) < 0.08) {
    orientation = 'square';
    orientationLabel = 'Square';
  } else if (height > width) {
    orientation = 'portrait';
    orientationLabel = 'Portrait';
  } else {
    orientation = 'landscape';
    orientationLabel = 'Landscape';
  }

  return {
    width,
    height,
    orientation,
    aspectLabel: aspectLabel(width, height),
    resolutionLabel: `${width} × ${height}`,
    orientationLabel,
  };
}

export function formatPickerSubtitle(meta: MarketingFormatMeta): string {
  return `${meta.orientationLabel} · ${meta.aspectLabel}`;
}

/** CSS aspect-ratio value (e.g. `9 / 16`) for template thumbnail frames. */
export function templateThumbnailAspectRatio(width: number, height: number): string {
  return `${width} / ${height}`;
}

/** Calendar previews are landscape cards (~5:4). */
export const CALENDAR_TEMPLATE_THUMBNAIL_ASPECT = '5 / 4';

export function templateThumbnailMaxHeight(orientation: FormatOrientation): string | undefined {
  if (orientation === 'portrait') return '9.5rem';
  return undefined;
}

export function resolveFormatOptionDimensions(
  options: Array<{ value: string; width: number; height: number }>,
  value: string
): { width: number; height: number; orientation: FormatOrientation } {
  const match = options.find((option) => option.value === value) ?? options[0];
  if (!match) {
    return { width: 1, height: 1, orientation: 'square' };
  }
  const meta = marketingFormatMeta(match.width, match.height);
  return { width: match.width, height: match.height, orientation: meta.orientation };
}
