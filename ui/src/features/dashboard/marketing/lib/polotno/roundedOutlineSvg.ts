import { svgToURL } from 'openpolotno/utils/svg';

/**
 * Continuous rounded-rect outline SVG.
 * OpenPolotno's figure→SVG path clips strokes to the fill, which turns thin
 * pills into left/right "C" brackets. Use this SVG instead for CTA chrome.
 */
export function roundedOutlineSvgMarkup(options: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  /** Defaults to full pill (half height). */
  cornerRadius?: number;
}): string {
  const { width, height, stroke } = options;
  const strokeWidth = Math.max(1, options.strokeWidth);
  const inset = strokeWidth / 2;
  const innerW = Math.max(1, width - strokeWidth);
  const innerH = Math.max(1, height - strokeWidth);
  const radius = Math.min(options.cornerRadius ?? height / 2, innerW / 2, innerH / 2);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" fill="none">`,
    `<rect x="${inset}" y="${inset}" width="${innerW}" height="${innerH}" rx="${radius}" ry="${radius}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
    `</svg>`,
  ].join('');
}

export function roundedOutlineSvgUrl(options: {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}): string {
  return svgToURL(roundedOutlineSvgMarkup(options));
}
