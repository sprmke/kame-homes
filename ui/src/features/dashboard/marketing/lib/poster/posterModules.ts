import { coverCropForFrame } from '@/features/dashboard/marketing/lib/collage/coverCrop';
import {
  uid,
  type PolotnoChild,
} from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PosterPalette } from '@/features/dashboard/marketing/lib/poster/posterColor';
import { rgba } from '@/features/dashboard/marketing/lib/poster/posterColor';
import type {
  PosterDisplayEffect,
  PosterTypeRole,
} from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  posterIconSvgUrl,
  posterSvgUrl,
  shortPosterLabel,
  type PosterIconName,
} from '@/features/dashboard/marketing/lib/poster/posterIcons';
import type { PosterFeature } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import {
  estimateTextWidth,
  fitText,
  type FittedText,
} from '@/features/dashboard/marketing/lib/poster/posterText';

import type { Rgb } from '@/lib/theme/colorConvert';

/**
 * Poster building blocks. Each returns plain Polotno children (so the result stays
 * a normal editable design) plus the height it used, so archetypes can stack
 * modules with a cursor instead of hard-coding every y.
 */

export type PosterCanvas = {
  width: number;
  height: number;
  short: number;
  pad: number;
  isPortrait: boolean;
  isStory: boolean;
  isWide: boolean;
  /** Smallest text size allowed on this canvas (~21px at 1080): phone-feed legibility. */
  minText: number;
  /** Bottom band covered by platform UI (Story reply bar); content stays above it. */
  safeBottom: number;
  /** Scale a length given as a fraction of the short side. */
  s: (ratio: number) => number;
};

export function createPosterCanvas(width: number, height: number): PosterCanvas {
  const short = Math.min(width, height);
  return {
    width,
    height,
    short,
    pad: Math.round(short * 0.06),
    isPortrait: height > width * 1.05,
    isStory: height / width > 1.6,
    isWide: width / height > 1.3,
    minText: Math.max(12, Math.round(short * 0.019)),
    safeBottom: height / width > 1.6 ? Math.round(height * 0.1) : 0,
    s: (ratio: number) => Math.round(short * ratio),
  };
}

/** Metadata the post-load fitter reads (see fitPosterTextSlots.ts). */
export type PosterSlotMeta = {
  maxHeight: number;
  minFontSize: number;
  anchor: 'top' | 'bottom';
  /** Deliberate overlap (script accent tucked under a headline); skipped by the audit. */
  allowOverlap?: boolean;
  /** Copy could not fit even at the legibility floor; the audit reports it. */
  overflow?: boolean;
  /** Sits on its own surface (pill, card, badge, glass), not directly on the photo. */
  onSurface?: boolean;
};

export type PosterTextInput = {
  name: string;
  value: string;
  role: PosterTypeRole;
  x: number;
  y: number;
  width: number;
  maxFontSize: number;
  minFontSize?: number;
  maxLines?: number;
  maxHeight?: number;
  fill: string;
  align?: 'left' | 'center' | 'right';
  /** `bottom` treats `y` as the box's bottom edge. */
  anchor?: 'top' | 'bottom';
  effect?: PosterDisplayEffect;
  outlineColor?: string;
  shadowColor?: string;
  opacity?: number;
  allowOverlap?: boolean;
  /** Legibility floor (canvas.minText); wins over min/max font sizes. */
  floor?: number;
  /** Decorative slot: return null instead of overflowing. */
  optional?: boolean;
  onSurface?: boolean;
};

export type PlacedText = { child: PolotnoChild; y: number; height: number; fitted: FittedText };

export function posterText(input: PosterTextInput): PlacedText | null {
  const value = input.value.trim();
  if (!value) return null;
  const floor = input.floor ?? 0;
  const maxFontSize = Math.max(input.maxFontSize, floor);
  const minFontSize = Math.max(input.minFontSize ?? Math.round(input.maxFontSize * 0.55), floor);
  const fitted = fitText(value, input.role, {
    maxWidth: input.width,
    maxFontSize,
    minFontSize,
    maxLines: input.maxLines ?? 2,
    maxHeight: input.maxHeight,
  });
  if (fitted.overflow && input.optional) return null;
  const height = Math.ceil(fitted.height * 1.04);
  const y = input.anchor === 'bottom' ? input.y - height : input.y;
  const effect = input.effect ?? 'none';
  const effectProps: Record<string, unknown> = {};
  if (effect === 'outline-shadow') {
    effectProps.stroke = input.outlineColor ?? '#ffffff';
    effectProps.strokeWidth = Math.max(2, Math.round(fitted.fontSize * 0.09));
  }
  if (effect === 'outline-shadow' || effect === 'soft-shadow') {
    Object.assign(effectProps, {
      shadowEnabled: true,
      shadowBlur: Math.round(fitted.fontSize * 0.14),
      shadowOffsetX: 0,
      shadowOffsetY: Math.round(fitted.fontSize * 0.04),
      shadowColor: input.shadowColor ?? '#000000',
      shadowOpacity: effect === 'outline-shadow' ? 0.28 : 0.3,
    });
  }
  const slot: PosterSlotMeta = {
    maxHeight: Math.max(height, input.maxHeight ?? height),
    minFontSize,
    anchor: input.anchor ?? 'top',
    ...(input.allowOverlap ? { allowOverlap: true } : {}),
    ...(fitted.overflow ? { overflow: true } : {}),
    ...(input.onSurface ? { onSurface: true } : {}),
  };
  return {
    y,
    height,
    fitted,
    child: {
      id: uid('poster-text'),
      type: 'text',
      name: input.name,
      text: fitted.lines.join('\n'),
      x: Math.round(input.x),
      y: Math.round(y),
      width: Math.round(input.width),
      height,
      fontSize: fitted.fontSize,
      fontFamily: input.role.family,
      fontWeight: input.role.weight,
      fontStyle: input.role.style ?? 'normal',
      letterSpacing: input.role.letterSpacing,
      lineHeight: input.role.lineHeight,
      textTransform: input.role.uppercase ? 'uppercase' : 'none',
      align: input.align ?? 'center',
      fill: input.fill,
      ...(input.opacity !== undefined ? { opacity: input.opacity } : {}),
      ...effectProps,
      custom: { posterSlot: slot },
    },
  };
}

export function rect(options: {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  cornerRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  shadow?: { blur: number; offsetY: number; opacity: number; color?: string };
  subType?: 'rect' | 'circle';
}): PolotnoChild {
  return {
    id: uid('poster-shape'),
    type: 'figure',
    subType: options.subType ?? 'rect',
    name: options.name,
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.width),
    height: Math.round(options.height),
    fill: options.fill,
    cornerRadius: options.cornerRadius ?? 0,
    stroke: options.stroke ?? 'rgba(0,0,0,0)',
    strokeWidth: options.strokeWidth ?? 0,
    ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
    ...(options.shadow
      ? {
          shadowEnabled: true,
          shadowBlur: options.shadow.blur,
          shadowOffsetX: 0,
          shadowOffsetY: options.shadow.offsetY,
          shadowOpacity: options.shadow.opacity,
          shadowColor: options.shadow.color ?? '#000000',
        }
      : {}),
  };
}

/** Vertical gradient band; `from`/`to` are alphas at the top/bottom edge. */
export function gradientScrim(options: {
  y: number;
  height: number;
  width: number;
  color: Rgb;
  from: number;
  to: number;
  name?: string;
}): PolotnoChild {
  return rect({
    name: options.name ?? 'Scrim',
    x: 0,
    y: options.y,
    width: options.width,
    height: options.height,
    fill: `linear-gradient(180deg, ${rgba(options.color, options.from)}, ${rgba(options.color, options.to)})`,
  });
}

export function iconElement(options: {
  icon: PosterIconName;
  x: number;
  y: number;
  size: number;
  color: string;
  strokeWidth?: number;
  name?: string;
  /** Sits directly on the photo, so legibility scrims must cover it. */
  onPhoto?: boolean;
}): PolotnoChild {
  return {
    id: uid('poster-icon'),
    type: 'svg',
    name: options.name ?? `Icon ${options.icon}`,
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.size),
    height: Math.round(options.size),
    src: posterIconSvgUrl(options.icon, {
      color: options.color,
      strokeWidth: options.strokeWidth ?? 1.6,
    }),
    keepRatio: true,
    ...(options.onPhoto ? { custom: { posterOnPhoto: true } } : {}),
  };
}

export type PhotoTreatment = {
  clipSrc?: string;
  cornerRadius?: number;
  /** 0 = keep top of the photo, 1 = keep bottom, 0.5 = centered. */
  focusY?: number;
  /** Subtle warm/bright grade, matching the reference posts. */
  grade?: boolean;
  borderColor?: string;
  borderSize?: number;
};

export function photoElement(options: {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalSize?: { width: number; height: number } | null;
  name?: string;
  treatment?: PhotoTreatment;
}): PolotnoChild {
  const treatment = options.treatment ?? {};
  let crop = { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
  if (options.naturalSize) {
    crop = coverCropForFrame(
      options.naturalSize.width,
      options.naturalSize.height,
      options.width,
      options.height
    );
    if (crop.cropHeight < 1 && treatment.focusY !== undefined) {
      crop.cropY = (1 - crop.cropHeight) * Math.max(0, Math.min(1, treatment.focusY));
    }
  }
  return {
    id: uid('poster-photo'),
    type: 'image',
    name: options.name ?? 'Photo',
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.width),
    height: Math.round(options.height),
    src: options.url,
    keepRatio: false,
    ...crop,
    ...(treatment.clipSrc ? { clipSrc: treatment.clipSrc } : {}),
    ...(treatment.cornerRadius ? { cornerRadius: treatment.cornerRadius } : {}),
    ...(treatment.borderSize
      ? { borderSize: treatment.borderSize, borderColor: treatment.borderColor ?? '#ffffff' }
      : {}),
    ...(treatment.grade ? { brightnessEnabled: true, brightness: 0.04 } : {}),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Organic corner blob: soft wave along one vertical and one horizontal edge.
 * `corner` names the corner that stays square (the one touching the canvas edge).
 */
export function organicClipSvgUrl(
  width: number,
  height: number,
  corner: 'top-right' | 'bottom-left' | 'right' | 'left'
): string {
  const W = width;
  const H = height;
  const p = (x: number, y: number) => {
    const flip = corner === 'bottom-left' || corner === 'left';
    return `${round(flip ? W - x : x)} ${round(flip ? H - y : y)}`;
  };
  let d: string;
  if (corner === 'top-right' || corner === 'bottom-left') {
    d = [
      `M${p(W * 0.1, 0)}`,
      `L${p(W, 0)}`,
      `L${p(W, H * 0.9)}`,
      `C${p(W * 0.82, H * 1.02)} ${p(W * 0.58, H * 0.88)} ${p(W * 0.36, H * 0.96)}`,
      `C${p(W * 0.14, H * 1.03)} ${p(-W * 0.01, H * 0.8)} ${p(W * 0.03, H * 0.52)}`,
      `C${p(W * 0.06, H * 0.3)} ${p(W * 0.0, H * 0.14)} ${p(W * 0.1, 0)}`,
      'Z',
    ].join(' ');
  } else {
    // Full-height panel with one wavy vertical edge on the left (mirrored for `left`).
    d = [
      `M${p(W * 0.1, 0)}`,
      `L${p(W, 0)}`,
      `L${p(W, H)}`,
      `L${p(W * 0.04, H)}`,
      `C${p(W * 0.16, H * 0.78)} ${p(-W * 0.02, H * 0.6)} ${p(W * 0.06, H * 0.42)}`,
      `C${p(W * 0.13, H * 0.26)} ${p(W * 0.02, H * 0.12)} ${p(W * 0.1, 0)}`,
      'Z',
    ].join(' ');
  }
  return posterSvgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="#000"/></svg>`
  );
}

/** Rounded pill with centered label; width hugs the text up to `maxWidth`. */
export function pill(options: {
  name: string;
  label: string;
  role: PosterTypeRole;
  centerX?: number;
  x?: number;
  y: number;
  height: number;
  maxWidth: number;
  fill: string;
  ink: string;
  icon?: PosterIconName;
  stroke?: string;
  shadow?: boolean;
  floor?: number;
  /** Keep the pill inside [min, max] horizontally after centering. */
  clampX?: [number, number];
}): { children: PolotnoChild[]; width: number; height: number; overflow: boolean } {
  const label = options.label.trim();
  if (!label) return { children: [], width: 0, height: 0, overflow: false };
  const padX = Math.round(options.height * 0.55);
  const iconSize = options.icon ? Math.round(options.height * 0.52) : 0;
  const iconGap = options.icon ? Math.round(options.height * 0.18) : 0;
  const floor = options.floor ?? 0;
  const fontCap = Math.max(Math.round(options.height * 0.42), floor);
  const textMax = options.maxWidth - padX * 2 - iconSize - iconGap;
  const fitted = fitText(label, options.role, {
    maxWidth: textMax,
    maxFontSize: fontCap,
    minFontSize: Math.max(Math.round(fontCap * 0.6), floor),
    maxLines: 1,
  });
  if (fitted.overflow) return { children: [], width: 0, height: 0, overflow: true };
  const textWidth = Math.min(
    textMax,
    Math.ceil(estimateTextWidth(fitted.lines[0] ?? label, options.role, fitted.fontSize) * 1.06)
  );
  const width = Math.round(textWidth + padX * 2 + iconSize + iconGap);
  let x = options.x ?? Math.round((options.centerX ?? width / 2) - width / 2);
  if (options.clampX) {
    x = Math.max(options.clampX[0], Math.min(x, options.clampX[1] - width));
  }
  const textHeight = Math.round(fitted.fontSize * options.role.lineHeight);
  const children: PolotnoChild[] = [
    rect({
      name: `${options.name} pill`,
      x,
      y: options.y,
      width,
      height: options.height,
      fill: options.fill,
      cornerRadius: options.height / 2,
      stroke: options.stroke,
      strokeWidth: options.stroke ? Math.max(1.5, options.height * 0.035) : 0,
      shadow: options.shadow
        ? { blur: options.height * 0.3, offsetY: options.height * 0.08, opacity: 0.18 }
        : undefined,
    }),
  ];
  if (options.icon) {
    children.push(
      iconElement({
        icon: options.icon,
        x: x + padX * 0.8,
        y: options.y + (options.height - iconSize) / 2,
        size: iconSize,
        color: options.ink,
        strokeWidth: 2,
      })
    );
  }
  children.push({
    id: uid('poster-text'),
    type: 'text',
    name: options.name,
    text: fitted.lines.join(' '),
    // Full inner width (not the estimate) so rounding can never wrap the label.
    x: x + padX * 0.5 + (options.icon ? iconSize + iconGap + padX * 0.3 : 0),
    y: Math.round(options.y + (options.height - textHeight) / 2),
    width: width - padX - (options.icon ? iconSize + iconGap + padX * 0.3 : 0),
    height: textHeight,
    fontSize: fitted.fontSize,
    fontFamily: options.role.family,
    fontWeight: options.role.weight,
    letterSpacing: options.role.letterSpacing,
    lineHeight: options.role.lineHeight,
    textTransform: options.role.uppercase ? 'uppercase' : 'none',
    align: 'center',
    fill: options.ink,
  });
  return { children, width, height: options.height, overflow: false };
}

/** Frosted panel. True backdrop blur isn't available in Polotno; a tinted translucent
 *  fill + hairline border reads as glass over photos at poster sizes. */
export function glassPanel(options: {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tint: Rgb;
  alpha: number;
  radius: number;
  borderAlpha?: number;
}): PolotnoChild {
  return rect({
    name: options.name,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    fill: rgba(options.tint, options.alpha),
    cornerRadius: options.radius,
    stroke: `rgba(255,255,255,${options.borderAlpha ?? 0.38})`,
    strokeWidth: Math.max(1, Math.round(options.radius * 0.05)),
    shadow: { blur: options.radius * 0.8, offsetY: options.radius * 0.15, opacity: 0.14 },
  });
}

/** Grid of icon + label cells, centered in `width`. */
export function iconRow(options: {
  features: PosterFeature[];
  x: number;
  y: number;
  width: number;
  iconSize: number;
  iconColor: string;
  labelColor: string;
  labelRole: PosterTypeRole;
  maxPerRow?: number;
  /** Draw each icon inside an outlined circle (Four J's info style). */
  ring?: boolean;
  labelScale?: number;
  floor?: number;
  /** Row sits on a card/panel (scrims ignore it); default is directly on the photo. */
  onSurface?: boolean;
}): { children: PolotnoChild[]; height: number } {
  if (options.features.length === 0) return { children: [], height: 0 };
  // Wide tracking on tiny labels hurts legibility and blows up word widths.
  const labelRole = {
    ...options.labelRole,
    letterSpacing: Math.min(options.labelRole.letterSpacing, 0.05),
  };
  const labelSize = Math.max(
    Math.round(options.iconSize * (options.labelScale ?? 0.34)),
    options.floor ?? 0
  );
  const initialPerRow = Math.min(options.features.length, options.maxPerRow ?? 5);
  const labelWidth = (options.width / initialPerRow) * 0.92;
  // A label that can't fit whole falls back to its curated short form ("Swimming Pool"
  // → "Pool"); otherwise the item is dropped, never broken mid-word.
  const items = options.features.flatMap((feature) => {
    const short = shortPosterLabel(feature.label);
    const candidates = short ? [feature.label, short] : [feature.label];
    for (const label of candidates) {
      const fitted = fitText(label, labelRole, {
        maxWidth: labelWidth,
        maxFontSize: labelSize,
        minFontSize: Math.max(Math.round(labelSize * 0.7), options.floor ?? 0),
        maxLines: 2,
      });
      if (!fitted.overflow) return [{ ...feature, label }];
    }
    return [];
  });
  if (items.length === 0) return { children: [], height: 0 };
  const perRow = Math.min(items.length, options.maxPerRow ?? 5);
  const rows = Math.ceil(items.length / perRow);
  const cellWidth = options.width / perRow;
  const labelBox = Math.round(labelSize * labelRole.lineHeight * 2.1);
  const gap = Math.round(options.iconSize * 0.18);
  const rowHeight = options.iconSize + gap + labelBox;
  const rowGap = Math.round(options.iconSize * 0.3);
  const children: PolotnoChild[] = [];

  items.forEach((feature, index) => {
    const row = Math.floor(index / perRow);
    const inRow = row === rows - 1 ? items.length - row * perRow : perRow;
    const rowOffset = ((perRow - inRow) * cellWidth) / 2;
    const col = index % perRow;
    const cellX = options.x + rowOffset + col * cellWidth;
    const top = options.y + row * (rowHeight + rowGap);
    const iconX = cellX + (cellWidth - options.iconSize) / 2;
    if (options.ring) {
      children.push(
        rect({
          name: 'Icon ring',
          subType: 'circle',
          x: iconX,
          y: top,
          width: options.iconSize,
          height: options.iconSize,
          fill: 'rgba(0,0,0,0)',
          stroke: options.iconColor,
          strokeWidth: Math.max(1.5, options.iconSize * 0.035),
        })
      );
    }
    const glyph = options.ring ? options.iconSize * 0.56 : options.iconSize;
    children.push(
      iconElement({
        icon: feature.icon,
        x: iconX + (options.iconSize - glyph) / 2,
        y: top + (options.iconSize - glyph) / 2,
        size: glyph,
        color: options.iconColor,
        onPhoto: !options.onSurface,
      })
    );
    const label = posterText({
      name: `Feature ${feature.label}`,
      value: feature.label,
      role: labelRole,
      x: cellX + cellWidth * 0.04,
      y: top + options.iconSize + gap,
      width: cellWidth * 0.92,
      maxFontSize: labelSize,
      minFontSize: Math.round(labelSize * 0.7),
      maxLines: 2,
      fill: options.labelColor,
      floor: options.floor,
      onSurface: options.onSurface,
    });
    if (label) children.push(label.child);
  });

  return { children, height: rows * rowHeight + (rows - 1) * rowGap };
}

export type InfoItem = { icon: PosterIconName; title: string; value: string };

/** Check-in / check-out / deposit band with ringed icons and hairline dividers. */
export function infoBar(options: {
  items: InfoItem[];
  x: number;
  y: number;
  width: number;
  height: number;
  palette: PosterPalette;
  titleRole: PosterTypeRole;
  valueRole: PosterTypeRole;
  fill?: string;
  ink?: string;
  radius?: number;
  floor?: number;
}): PolotnoChild[] {
  const items = options.items.filter((item) => item.value.trim());
  if (items.length === 0) return [];
  const ink = options.ink ?? options.palette.fieldInk;
  const children: PolotnoChild[] = [
    rect({
      name: 'Info bar',
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      fill: options.fill ?? options.palette.field,
      cornerRadius: options.radius ?? 0,
    }),
  ];
  const cell = options.width / items.length;
  const ring = Math.round(options.height * 0.46);
  const titleSize = Math.round(options.height * 0.15);
  const valueSize = Math.round(options.height * 0.19);
  items.forEach((item, index) => {
    const cellX = options.x + index * cell;
    const padL = Math.round(cell * 0.08);
    const ringY = options.y + (options.height - ring) / 2;
    children.push(
      rect({
        name: 'Info ring',
        subType: 'circle',
        x: cellX + padL,
        y: ringY,
        width: ring,
        height: ring,
        fill: 'rgba(0,0,0,0)',
        stroke: ink,
        strokeWidth: Math.max(1.5, ring * 0.04),
      }),
      iconElement({
        icon: item.icon,
        x: cellX + padL + ring * 0.2,
        y: ringY + ring * 0.2,
        size: ring * 0.6,
        color: ink,
      })
    );
    const textX = cellX + padL + ring + Math.round(cell * 0.06);
    const textWidth = cell - (textX - cellX) - Math.round(cell * 0.04);
    const title = posterText({
      name: item.title,
      value: item.title,
      role: options.titleRole,
      x: textX,
      y: options.y + options.height * 0.26,
      width: textWidth,
      maxFontSize: titleSize,
      minFontSize: Math.round(titleSize * 0.7),
      maxLines: 2,
      align: 'left',
      fill: ink,
      floor: options.floor,
      onSurface: true,
    });
    const value = posterText({
      name: `${item.title} value`,
      value: item.value,
      role: options.valueRole,
      x: textX,
      y:
        (title ? title.y + title.height : options.y + options.height * 0.3) + options.height * 0.03,
      width: textWidth,
      maxFontSize: valueSize,
      minFontSize: Math.round(valueSize * 0.7),
      maxLines: 1,
      align: 'left',
      fill: ink,
      floor: options.floor,
      onSurface: true,
    });
    if (title) children.push(title.child);
    if (value) children.push(value.child);
    if (index > 0) {
      children.push(
        rect({
          name: 'Divider',
          x: cellX,
          y: options.y + options.height * 0.22,
          width: Math.max(1, Math.round(options.height * 0.012)),
          height: options.height * 0.56,
          fill: ink,
          opacity: 0.35,
        })
      );
    }
  });
  return children;
}

/** Circular sticker ("PS5 + games for the ultimate staycation"). */
export function stickerBadge(options: {
  text: string;
  centerX: number;
  centerY: number;
  diameter: number;
  fill: string;
  ink: string;
  role: PosterTypeRole;
  sparkleColor: string;
  floor?: number;
}): PolotnoChild[] {
  const value = options.text.trim();
  if (!value) return [];
  const d = options.diameter;
  const x = options.centerX - d / 2;
  const y = options.centerY - d / 2;
  const inner = d * 0.68;
  const label = posterText({
    name: 'Badge',
    value,
    role: options.role,
    x: options.centerX - inner / 2,
    y: options.centerY,
    width: inner,
    maxFontSize: Math.round(d * 0.15),
    minFontSize: Math.round(d * 0.075),
    maxLines: 4,
    maxHeight: inner,
    fill: options.ink,
    floor: options.floor,
    onSurface: true,
  });
  const children: PolotnoChild[] = [
    rect({
      name: 'Badge',
      subType: 'circle',
      x,
      y,
      width: d,
      height: d,
      fill: options.fill,
      stroke: options.ink,
      strokeWidth: Math.max(2, d * 0.018),
      shadow: { blur: d * 0.1, offsetY: d * 0.03, opacity: 0.25 },
    }),
  ];
  if (label) {
    label.child.y = Math.round(options.centerY - label.height / 2);
    children.push(label.child);
  }
  children.push(
    iconElement({
      icon: 'sparkles',
      x: x + d * 0.78,
      y: y - d * 0.04,
      size: d * 0.22,
      color: options.sparkleColor,
      strokeWidth: 1.8,
    })
  );
  return children;
}

/** Three short hand-drawn strokes, the "burst" accent beside a headline. */
export function burstOrnament(options: {
  x: number;
  y: number;
  size: number;
  color: string;
  mirror?: boolean;
}): PolotnoChild {
  const s = 48;
  const lines = [
    [8, 14, 18, 22],
    [4, 28, 17, 29],
    [9, 42, 19, 36],
  ]
    .map(([x1, y1, x2, y2]) => {
      const fx = (v: number) => (options.mirror ? s - v : v);
      return `<line x1="${fx(x1!)}" y1="${y1}" x2="${fx(x2!)}" y2="${y2}"/>`;
    })
    .join('');
  return {
    id: uid('poster-ornament'),
    type: 'svg',
    name: 'Ornament',
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.size),
    height: Math.round(options.size),
    src: posterSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" stroke="${options.color}" stroke-width="3.2" stroke-linecap="round">${lines}</svg>`
    ),
    keepRatio: true,
  };
}

export function logoElement(options: {
  url: string;
  x: number;
  y: number;
  size: number;
  round?: boolean;
}): PolotnoChild {
  return {
    id: uid('poster-logo'),
    type: 'image',
    name: 'Logo',
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.size),
    height: Math.round(options.size),
    src: options.url,
    keepRatio: true,
    ...(options.round ? { cornerRadius: options.size / 2 } : {}),
  };
}
