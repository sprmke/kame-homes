import { figureToSvg, TYPES } from 'openpolotno/utils/figure-to-svg';
import { svgToURL } from 'openpolotno/utils/svg';

import { roundedOutlineSvgUrl } from '@/features/dashboard/marketing/lib/polotno/roundedOutlineSvg';

const DEFAULT_FILL = 'rgba(191, 191, 191, 100)';
const DEFAULT_STROKE = '#0c0c0c';
const OUTLINE_STROKE = '#f5f5f4';

export type KamePolotnoShape = {
  id: string;
  label: string;
  /** How the element is added to the canvas. */
  kind: 'figure' | 'outline-svg';
  subType?: string;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  url: string;
  /** Drop size on canvas when set (preview thumb may differ). */
  canvasWidth?: number;
  canvasHeight?: number;
};

const FIGURE_SHAPES: Omit<KamePolotnoShape, 'url' | 'id' | 'label' | 'kind'>[] = [
  {
    subType: 'rect',
    width: 280,
    height: 88,
    cornerRadius: 44,
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 0,
    canvasWidth: 480,
    canvasHeight: 96,
  },
  {
    subType: 'rect',
    width: 220,
    height: 120,
    cornerRadius: 20,
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 0,
    canvasWidth: 320,
    canvasHeight: 160,
  },
  {
    subType: 'circle',
    width: 220,
    height: 220,
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 0,
  },
  {
    subType: 'rect',
    width: 280,
    height: 160,
    cornerRadius: 0,
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 0,
  },
];

const BASIC_SUBTYPES = ['triangle', 'diamond', 'rightArrow', 'leftArrow'] as const;

function withPreviewUrl(shape: Omit<KamePolotnoShape, 'url'>): KamePolotnoShape {
  if (shape.kind === 'outline-svg') {
    return {
      ...shape,
      url: roundedOutlineSvgUrl({
        width: shape.width,
        height: shape.height,
        stroke: shape.stroke,
        strokeWidth: Math.max(2, shape.strokeWidth),
        cornerRadius: shape.cornerRadius ?? shape.height / 2,
      }),
    };
  }

  return {
    ...shape,
    url: svgToURL(
      figureToSvg({
        subType: shape.subType ?? 'rect',
        width: shape.width,
        height: shape.height,
        fill: shape.fill,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        ...(shape.cornerRadius != null ? { cornerRadius: shape.cornerRadius } : {}),
      } as Parameters<typeof figureToSvg>[0] & { cornerRadius?: number })
    ),
  };
}

export function buildKamePolotnoShapes(): KamePolotnoShape[] {
  const outlineCta = withPreviewUrl({
    id: 'outline-cta',
    label: 'CTA outline',
    kind: 'outline-svg',
    width: 280,
    height: 88,
    cornerRadius: 44,
    fill: 'rgba(0,0,0,0)',
    stroke: OUTLINE_STROKE,
    strokeWidth: 4,
    canvasWidth: 480,
    canvasHeight: 96,
  });

  const filled = FIGURE_SHAPES.map((shape, index) =>
    withPreviewUrl({
      id: `figure-${shape.subType}-${index}`,
      label: shape.subType === 'circle' ? 'Circle' : shape.cornerRadius ? 'Rounded' : 'Rectangle',
      kind: 'figure',
      ...shape,
    })
  );

  const basics = BASIC_SUBTYPES.filter((subType) => subType in TYPES).map((subType) =>
    withPreviewUrl({
      id: `figure-${subType}`,
      label: subType,
      kind: 'figure',
      subType,
      width: 220,
      height: 220,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      strokeWidth: 0,
    })
  );

  return [outlineCta, ...filled, ...basics];
}

export const KAME_POLOTNO_DEFAULT_SHAPE_FILL = DEFAULT_FILL;
