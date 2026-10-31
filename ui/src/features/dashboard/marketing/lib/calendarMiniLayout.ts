/**
 * Calendar template card art as plain shapes (no DOM calendar, no fonts, no capture).
 *
 * A full `CalendarPreview` per card meant ~16 live calendars (42 cells each, web fonts,
 * photo backgrounds) under the editor. This reduces a layout to a few dozen SVG shapes
 * that keep what tells layouts apart: canvas size, card color and corners, cell shape
 * (block / circle / ring / ink only), state colors and the legend.
 */

import type {
  BackgroundConfig,
  CalendarStyles,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  CALENDAR_CANVAS_DIMENSIONS,
  normalizeCalendarCanvasFrame,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

export type MiniCellShape = 'block' | 'circle' | 'ring' | 'ink';
export type MiniCellState = 'available' | 'booked' | 'blocked' | 'empty';

export type MiniCell = {
  x: number;
  y: number;
  size: number;
  state: MiniCellState;
  fill: string;
  stroke: string | null;
};

export type CalendarMiniLayout = {
  width: number;
  height: number;
  canvasFill: string;
  card: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fill: string;
    imageUrl: string | null;
    overlay: string | null;
  };
  titleBar: { x: number; y: number; width: number; height: number; fill: string };
  subtitleBar: { x: number; y: number; width: number; height: number; fill: string } | null;
  dayNames: Array<{ x: number; y: number; width: number; height: number; fill: string }>;
  shape: MiniCellShape;
  cellRadius: number;
  cells: MiniCell[];
  legend: Array<{ x: number; y: number; r: number; fill: string }>;
};

/** Mock month: same states the editor preview uses (bookings 5–8, 12–14, 20–25). */
const BOOKED = new Set([5, 6, 7, 8, 12, 13, 14, 20, 21, 22, 23, 24, 25]);
const BLOCKED = new Set([1, 2, 28, 29, 30]);
const LEADING_EMPTY = 3;
const DAYS_IN_MONTH = 30;

function isTransparent(color: string | undefined | null): boolean {
  if (!color) return true;
  const value = color.trim().toLowerCase();
  return (
    value === 'transparent' ||
    value === 'none' ||
    /^rgba\(.*,\s*0(\.0+)?\s*\)$/.test(value) ||
    /^#[0-9a-f]{6}00$/.test(value)
  );
}

/** Solid color for a background (first gradient stop, else the color). */
export function backgroundColor(background: BackgroundConfig | undefined, fallback: string) {
  if (!background) return fallback;
  if (background.type === 'gradient' && background.gradient?.stops?.length) {
    return background.gradient.stops[0]!.color || fallback;
  }
  return background.color || fallback;
}

function backgroundImage(background: BackgroundConfig | undefined): string | null {
  if (!background || background.type !== 'image') return null;
  const url = background.imageUrl ?? background.image?.url ?? null;
  return url && /^https?:\/\//.test(url) ? url : null;
}

export function miniCellShape(styles: CalendarStyles, cellSize: number): MiniCellShape {
  const fill = backgroundColor(styles.available.background, styles.cell.background.color);
  const border = styles.available.border ?? styles.cell.border;
  const hasFill = !isTransparent(fill);
  const hasBorder =
    Boolean(border) && border.style !== 'none' && border.width > 0 && !isTransparent(border.color);
  if (!hasFill && !hasBorder) return 'ink';
  const radius = Math.max(styles.cell.borderRadius ?? 0, border?.radius ?? 0);
  const round = radius >= cellSize * 0.4;
  if (!hasFill) return round ? 'ring' : 'block';
  return round ? 'circle' : 'block';
}

function stateOf(day: number): MiniCellState {
  if (BLOCKED.has(day)) return 'blocked';
  if (BOOKED.has(day)) return 'booked';
  return 'available';
}

function stateFill(styles: CalendarStyles, state: MiniCellState, shape: MiniCellShape): string {
  if (shape === 'ink') {
    if (state === 'booked') return styles.booked.dayNumberColor || '#64748b';
    if (state === 'blocked') return styles.blocked.dayNumberColor || '#cbd5e1';
    return styles.available.dayNumberColor || styles.cell.dayNumber.color || '#0f172a';
  }
  if (state === 'booked') return backgroundColor(styles.booked.background, '#cbd5e1');
  if (state === 'blocked') return backgroundColor(styles.blocked.background, '#e2e8f0');
  if (state === 'empty') return backgroundColor(styles.cell.empty?.background, 'transparent');
  return backgroundColor(styles.available.background, styles.cell.background.color);
}

function stateStroke(styles: CalendarStyles, state: MiniCellState): string | null {
  const border =
    state === 'booked'
      ? styles.booked.border
      : state === 'blocked'
        ? styles.blocked.border
        : styles.available.border;
  if (!border || border.style === 'none' || border.width <= 0 || isTransparent(border.color)) {
    return null;
  }
  return border.color;
}

/** Shapes for one layout at its canvas size (viewBox units = canvas px / 10). */
export function calendarMiniLayout(styles: CalendarStyles): CalendarMiniLayout {
  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame);
  const dims = CALENDAR_CANVAS_DIMENSIONS[frame.format];
  const width = dims.width / 10;
  const height = dims.height / 10;

  const padding = frame.format === 'square' ? 0 : Math.max(4, (frame.padding ?? 60) / 10);
  const scale = frame.format === 'square' ? 1 : Math.min(1, (frame.calendarScale ?? 90) / 100);
  const available = Math.min(width, height) - padding * 2;
  const cardSize = frame.format === 'square' ? width : available * scale;
  const cardX = (width - cardSize) / 2;
  const cardY = (height - cardSize) / 2;
  const cardRadius = Math.min(cardSize / 4, (styles.container.borderRadius ?? 0) / 10);

  const inset = cardSize * 0.07;
  const innerX = cardX + inset;
  const innerWidth = cardSize - inset * 2;
  const headerColor =
    styles.header.monthYear?.color || styles.header.title?.color || styles.cell.dayNumber.color;
  const titleHeight = cardSize * 0.055;
  const titleWidth = innerWidth * 0.5;
  const titleAlign = styles.header.title?.alignment ?? 'center';
  const titleX =
    titleAlign === 'left'
      ? innerX
      : titleAlign === 'right'
        ? innerX + innerWidth - titleWidth
        : innerX + (innerWidth - titleWidth) / 2;
  const titleY = cardY + inset;

  const subtitleShown = Boolean(styles.header.subtitle?.show);
  const subtitleBar = subtitleShown
    ? {
        x: titleAlign === 'left' ? innerX : innerX + (innerWidth - titleWidth * 0.7) / 2,
        y: titleY + titleHeight * 1.5,
        width: titleWidth * 0.7,
        height: titleHeight * 0.45,
        fill: styles.header.subtitle.color || headerColor,
      }
    : null;

  const gap = Math.min(innerWidth * 0.02, (styles.grid.gap ?? 4) / 10);
  const cellSize = (innerWidth - gap * 6) / 7;
  const namesY =
    (subtitleBar ? subtitleBar.y + subtitleBar.height : titleY + titleHeight) + inset * 0.6;
  const dayNames = styles.dayNames.show
    ? Array.from({ length: 7 }, (_, index) => ({
        x: innerX + index * (cellSize + gap) + cellSize * 0.25,
        y: namesY,
        width: cellSize * 0.5,
        height: cellSize * 0.18,
        fill: styles.dayNames.color || headerColor,
      }))
    : [];
  const gridY = namesY + (dayNames.length > 0 ? cellSize * 0.18 + gap * 2 : 0);

  const shape = miniCellShape(styles, cellSize * 10);
  const cellRadius =
    shape === 'circle' || shape === 'ring'
      ? cellSize / 2
      : Math.min(cellSize / 3, (styles.cell.borderRadius ?? 0) / 10);

  const cells: MiniCell[] = [];
  const totalSlots = 35;
  for (let slot = 0; slot < totalSlots; slot += 1) {
    const day = slot - LEADING_EMPTY + 1;
    const state: MiniCellState = day < 1 || day > DAYS_IN_MONTH ? 'empty' : stateOf(day);
    const column = slot % 7;
    const row = Math.floor(slot / 7);
    const size = shape === 'ink' ? cellSize * 0.32 : cellSize;
    const offset = (cellSize - size) / 2;
    cells.push({
      x: innerX + column * (cellSize + gap) + offset,
      y: gridY + row * (cellSize + gap) + offset,
      size,
      state,
      fill: stateFill(styles, state, shape),
      stroke: shape === 'ring' || shape === 'block' ? stateStroke(styles, state) : null,
    });
  }

  const legend: CalendarMiniLayout['legend'] = [];
  if (styles.legend?.show) {
    const legendY = gridY + 5 * (cellSize + gap) + gap * 1.5;
    const r = cellSize * 0.12;
    if (legendY + r < cardY + cardSize) {
      (['available', 'booked', 'blocked'] as const).forEach((state, index) => {
        legend.push({
          x: innerX + innerWidth / 2 + (index - 1) * cellSize * 1.6,
          y: legendY + r,
          r,
          fill: stateFill(styles, state, shape === 'ink' ? 'block' : shape),
        });
      });
    }
  }

  return {
    width,
    height,
    canvasFill:
      frame.format === 'square'
        ? backgroundColor(styles.container.background, '#ffffff')
        : backgroundColor(frame.background, '#f4f4f5'),
    card: {
      x: cardX,
      y: cardY,
      width: cardSize,
      height: cardSize,
      radius: frame.format === 'square' ? 0 : cardRadius,
      fill: backgroundColor(styles.container.background, '#ffffff'),
      imageUrl: backgroundImage(styles.container.background),
      overlay: styles.container.background?.overlay ?? null,
    },
    titleBar: { x: titleX, y: titleY, width: titleWidth, height: titleHeight, fill: headerColor },
    subtitleBar,
    dayNames,
    shape,
    cellRadius,
    cells,
    legend,
  };
}
