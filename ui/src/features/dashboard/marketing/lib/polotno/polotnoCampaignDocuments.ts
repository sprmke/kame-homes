import {
  resolveCampaignPalette,
  type CampaignPalette,
} from '@/features/dashboard/marketing/lib/designBrandColors';
import {
  campaignTemplateBaseId,
  getCampaignTemplate,
} from '@/features/dashboard/marketing/lib/designCampaignTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { squareImageCoverCrop } from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';
import { roundedOutlineSvgUrl } from '@/features/dashboard/marketing/lib/polotno/roundedOutlineSvg';
import { DESIGN_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/templateRegistry';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import {
  applyCampaignFontsToDocument,
  campaignFontMap,
  themeToCampaignPalette,
} from '@/features/dashboard/marketing/lib/theme/designThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

/**
 * Editorial design system ("Quiet Coast"): photo-led compositions with the brand
 * accent used sparingly (a rule, a ring, one small chip) — never as a full shape
 * or badge. Fraunces carries headlines, Jost carries tracked small-caps labels,
 * Space Grotesk carries date numerals. No stars/hexagons/diamonds/sunbursts/rotation.
 */

export type PolotnoChild = Record<string, unknown>;

let idCounter = 0;

export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function resetIds(): void {
  idCounter = 0;
}

export const FONT_DISPLAY = 'Fraunces';
export const FONT_LABEL = 'Jost';
export const FONT_BODY = 'Plus Jakarta Sans';
export const FONT_NUMERAL = 'Space Grotesk';

export type CampaignLayout = {
  width: number;
  height: number;
  short: number;
  isPortrait: boolean;
  isWide: boolean;
  pad: number;
  font: (ratio: number) => number;
  y: (ratio: number) => number;
  w: (ratio: number) => number;
  size: (ratio: number) => number;
};

export function createCampaignLayout(width: number, height: number): CampaignLayout {
  const short = Math.min(width, height);
  return {
    width,
    height,
    short,
    isPortrait: height > width * 1.05,
    isWide: width / height > 1.3,
    pad: Math.round(width * 0.056),
    font: (ratio: number) => Math.round(short * ratio),
    y: (ratio: number) => Math.round(height * ratio),
    w: (ratio: number) => Math.round(width * ratio),
    size: (ratio: number) => Math.round(short * ratio),
  };
}

export function band<T>(layout: CampaignLayout, values: { portrait: T; square: T; wide: T }): T {
  if (layout.isPortrait) return values.portrait;
  if (layout.isWide) return values.wide;
  return values.square;
}

export function textBoxHeight(fontSize: number, lineCount = 1, lineHeight = 1.15): number {
  return Math.round(fontSize * lineCount * lineHeight * 1.05);
}

/**
 * Strips `undefined` values from an object. Needed because spreading an
 * options object that explicitly carries `key: undefined` (e.g. from an
 * optional caller param passed straight through) overrides an
 * already-computed default of the same key — silently reverting it back to
 * `undefined`, which the Polotno model then fills with its own schema
 * default (often not what we want, e.g. `width` defaults to 100px).
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

export function campaignPageBackground(src: string | null, fallback: string): string {
  return src ?? fallback;
}

export type Scrim = { r: number; g: number; b: number; top: number; bottom: number };

/** Bottom-anchored gradient scrim — lets the photo breathe up top, stays legible at the bottom. */
export function photoScrim(width: number, height: number, scrim: Scrim): PolotnoChild {
  const { r, g, b, top, bottom } = scrim;
  return {
    id: uid('photo-scrim'),
    type: 'figure',
    subType: 'rect',
    name: 'Photo scrim',
    x: 0,
    y: 0,
    width,
    height,
    fill: `linear-gradient(180deg, rgba(${r},${g},${b},${top}), rgba(${r},${g},${b},${bottom}))`,
    locked: false,
    selectable: true,
  };
}

export type FigureOptions = {
  name?: string;
  subType?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  cornerRadius?: number;
  opacity?: number;
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  shadowOpacity?: number;
};

export function figure(options: FigureOptions): PolotnoChild {
  return {
    id: uid(options.name?.toLowerCase().replace(/ /g, '-') || options.subType || 'figure'),
    type: 'figure',
    subType: options.subType ?? 'rect',
    ...options,
  };
}

export type TextOptions = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  height?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

export function text(rawOptions: TextOptions): PolotnoChild {
  const options = omitUndefined(rawOptions) as TextOptions;
  const lineCount = Math.max(1, options.text.split('\n').length);
  const lineHeight = options.lineHeight ?? 1.15;
  const height = options.height ?? textBoxHeight(options.fontSize, lineCount, lineHeight);
  return {
    id: uid('text'),
    type: 'text',
    fontFamily: FONT_BODY,
    fontWeight: '600',
    align: 'center',
    ...options,
    lineHeight,
    height,
  };
}

/**
 * NOTE ON UNITS: OpenPolotno multiplies `letterSpacing` by `fontSize` before
 * handing it to Konva (`letterSpacing * fontSize` px). So this value is an
 * **em multiplier**, not a pixel offset — 1 = one full character-width of
 * gap. Editorial tracked-caps read well around 0.14–0.2; anything above ~0.5
 * wraps single-character text boxes onto their own lines.
 */
export type InlineTextOptions = {
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: string;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  lineHeight?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

/** Full-width, centered, top-aligned text block — the default for most copy. */
export function centeredText(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fontRatio: number,
  fill: string,
  options?: InlineTextOptions
): PolotnoChild {
  const clean = options ? (omitUndefined(options) as InlineTextOptions) : undefined;
  return text({
    text: copy,
    x: layout.pad,
    y: layout.y(topRatio),
    width: clean?.width ?? layout.width - layout.pad * 2,
    fontSize: layout.font(fontRatio),
    fill,
    ...clean,
  });
}

/** Small tracked uppercase label — the recurring "eyebrow" device. */
export function eyebrow(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fill: string,
  fontRatio = 0.03
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    fontFamily: FONT_LABEL,
    fontWeight: '500',
    letterSpacing: 0.16,
    textTransform: 'uppercase',
  });
}

/** Large serif headline — typography carries the hero moment, not a shape. */
export function heroText(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fontRatio: number,
  fill: string,
  options?: {
    italic?: boolean;
    weight?: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
  }
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    fontFamily: FONT_DISPLAY,
    fontStyle: options?.italic ? 'italic' : 'normal',
    fontWeight: options?.weight ?? '600',
    lineHeight: 1.02,
    width: options?.width,
    align: options?.align,
  });
}

export function detailText(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fill: string,
  fontRatio = 0.032
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    fontFamily: FONT_BODY,
    fontWeight: '500',
    lineHeight: 1.3,
  });
}

export function thinRule(
  layout: CampaignLayout,
  leftRatio: number,
  topRatio: number,
  widthRatio: number,
  color: string,
  opacity = 0.85
): PolotnoChild {
  return figure({
    name: 'Rule',
    x: layout.w(leftRatio),
    y: layout.y(topRatio),
    width: layout.w(widthRatio),
    height: Math.max(1, Math.round(layout.short * 0.0016)),
    fill: color,
    opacity,
  });
}

export function thinVRule(
  layout: CampaignLayout,
  xRatio: number,
  topRatio: number,
  heightRatio: number,
  color: string,
  opacity = 0.4
): PolotnoChild {
  return figure({
    name: 'Divider',
    x: layout.w(xRatio),
    y: layout.y(topRatio),
    width: Math.max(1, Math.round(layout.short * 0.0016)),
    height: layout.size(heightRatio),
    fill: color,
    opacity,
  });
}

export function outlinePill(
  copy: string,
  layout: CampaignLayout,
  leftRatio: number,
  topRatio: number,
  widthRatio: number,
  heightRatio: number,
  color: string
): PolotnoChild[] {
  const width = layout.w(widthRatio);
  const height = layout.size(heightRatio);
  const x = layout.w(leftRatio);
  const y = layout.y(topRatio);
  const fontSize = Math.round(height * 0.34);
  const strokeWidth = Math.max(1.5, Math.round(height * 0.05));
  return [
    {
      id: uid('cta-outline'),
      type: 'svg',
      name: 'CTA outline',
      x,
      y,
      width,
      height,
      src: roundedOutlineSvgUrl({
        width,
        height,
        stroke: color,
        strokeWidth,
        cornerRadius: height / 2,
      }),
      keepRatio: false,
      stretchEnabled: true,
    },
    text({
      text: copy,
      x,
      y: y + height * 0.3,
      width,
      fontSize,
      fill: color,
      fontFamily: FONT_LABEL,
      fontWeight: '600',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
    }),
  ];
}

/** Numeral + day-name, vertically centered on `centerY` (pixels). */
export function dateMark(
  dateNum: string,
  dayName: string,
  layout: CampaignLayout,
  centerXRatio: number,
  centerY: number,
  numeralFontRatio: number,
  foreground: string
): PolotnoChild[] {
  const numeralSize = layout.font(numeralFontRatio);
  const daySize = Math.round(numeralSize * 0.24);
  const gap = Math.round(numeralSize * 0.1);
  const numeralHeight = Math.round(numeralSize * 1.05);
  const dayHeight = Math.round(daySize * 1.3);
  const blockHeight = numeralHeight + gap + dayHeight;
  const top = Math.round(centerY - blockHeight / 2);
  const width = layout.size(numeralFontRatio * 2.6);
  const centerX = layout.w(centerXRatio);
  const children: PolotnoChild[] = [
    text({
      text: dateNum,
      x: centerX - width / 2,
      y: top,
      width,
      height: numeralHeight,
      fontSize: numeralSize,
      fill: foreground,
      fontFamily: FONT_NUMERAL,
      fontWeight: '600',
      lineHeight: 1,
      letterSpacing: -0.02,
    }),
  ];
  if (dayName) {
    children.push(
      text({
        text: dayName.toUpperCase(),
        x: centerX - width / 2,
        y: top + numeralHeight + gap,
        width,
        height: dayHeight,
        fontSize: daySize,
        fill: foreground,
        fontFamily: FONT_LABEL,
        fontWeight: '500',
        letterSpacing: 0.14,
        textTransform: 'uppercase',
      })
    );
  }
  return children;
}

/** The one signature device repeated across every preset: a slim inset frame. */
export function galleryFooter(
  binding: DesignBinding,
  layout: CampaignLayout,
  color: string
): PolotnoChild {
  const top = band(layout, { portrait: 0.946, square: 0.936, wide: 0.902 });
  return centeredText(
    binding.propertyName,
    layout,
    top,
    band(layout, { portrait: 0.024, square: 0.026, wide: 0.023 }),
    color,
    { fontFamily: FONT_LABEL, fontWeight: '600', letterSpacing: 0.18, textTransform: 'uppercase' }
  );
}

/** Small circular logo mark (1×1, full corner radius) placed in the upper area. */
export function logoImage(
  url: string,
  layout: CampaignLayout,
  topRatio: number,
  sizeRatio: number,
  naturalSize?: { width: number; height: number }
): PolotnoChild {
  const size = layout.size(sizeRatio);
  const crop = naturalSize
    ? squareImageCoverCrop(naturalSize.width, naturalSize.height)
    : { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
  return {
    id: uid('logo'),
    type: 'image',
    name: 'Org logo',
    x: layout.width - size - layout.pad,
    y: layout.y(topRatio),
    width: size,
    height: size,
    src: url,
    keepRatio: false,
    stretchEnabled: false,
    cornerRadius: size / 2,
    ...crop,
  };
}

/** Property photo as a real image node (figure `fill` URLs do not paint). */
export function photoImage(
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
  name = 'Property photo'
): PolotnoChild {
  return {
    id: uid('photo'),
    type: 'image',
    name,
    x,
    y,
    width,
    height,
    src: url,
    keepRatio: false,
  };
}

function buildPromo500OffPoster(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const v = band(layout, {
    portrait: { eyebrow: 0.1, upTo: 0.165, amount: 0.215, rule: 0.4, detail: 0.44, cta: 0.83 },
    square: { eyebrow: 0.085, upTo: 0.15, amount: 0.195, rule: 0.385, detail: 0.425, cta: 0.83 },
    wide: { eyebrow: 0.08, upTo: 0.2, amount: 0.26, rule: 0.6, detail: 0.66, cta: 0.8 },
  });
  return [
    eyebrow('Rainy Season Promo', layout, v.eyebrow, palette.cream),
    centeredText(
      'Up to',
      layout,
      v.upTo,
      band(layout, { portrait: 0.034, square: 0.036, wide: 0.032 }),
      palette.cream,
      {
        fontFamily: FONT_LABEL,
        fontWeight: '500',
        letterSpacing: 0.16,
        textTransform: 'uppercase',
      }
    ),
    heroText(
      '₱500 off',
      layout,
      v.amount,
      band(layout, { portrait: 0.135, square: 0.148, wide: 0.13 }),
      palette.cream
    ),
    thinRule(layout, 0.38, v.rule, 0.24, palette.accent),
    detailText(
      'For weekday bookings',
      layout,
      v.detail,
      palette.cream,
      band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
    ),
    ...outlinePill('Book now', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildPromo300OffSplit(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const panelWidthRatio = band(layout, { portrait: 0.46, square: 0.44, wide: 0.36 });
  const panelWidth = layout.w(panelWidthRatio);
  const pad = Math.round(panelWidth * 0.16);
  const textWidth = panelWidth - pad * 2;
  const eyebrowSize = layout.font(band(layout, { portrait: 0.024, square: 0.026, wide: 0.026 }));
  // Sized to the narrow accent column, not the full canvas — a display face
  // at "hero" scale would wrap character-by-character in ~⅓ of the width.
  const amountSize = layout.font(band(layout, { portrait: 0.086, square: 0.082, wide: 0.13 }));
  const detailSize = layout.font(band(layout, { portrait: 0.028, square: 0.03, wide: 0.026 }));
  const ruleWidth = Math.round(textWidth * 0.5);

  let cursor = layout.y(band(layout, { portrait: 0.14, square: 0.13, wide: 0.16 }));
  const eyebrowY = cursor;
  cursor += textBoxHeight(eyebrowSize, 1) + Math.round(amountSize * 0.55);
  const amountY = cursor;
  cursor += textBoxHeight(amountSize, 2, 0.98) + Math.round(amountSize * 0.32);
  const ruleY = cursor;
  cursor += Math.round(layout.short * 0.028);
  const detailY = cursor;

  return [
    figure({
      name: 'Accent panel',
      x: 0,
      y: 0,
      width: panelWidth,
      height: layout.height,
      fill: palette.accentDark,
    }),
    figure({
      name: 'Panel seam',
      x: panelWidth - 1,
      y: 0,
      width: Math.max(1, Math.round(layout.short * 0.0016)),
      height: layout.height,
      fill: palette.cream,
      opacity: 0.4,
    }),
    text({
      text: 'Weekday Promo',
      x: pad,
      y: eyebrowY,
      width: textWidth,
      fontSize: eyebrowSize,
      fill: palette.cream,
      fontFamily: FONT_LABEL,
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    }),
    text({
      text: '₱300\noff',
      x: pad,
      y: amountY,
      width: textWidth,
      fontSize: amountSize,
      fill: palette.cream,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600',
      lineHeight: 0.98,
      align: 'left',
    }),
    figure({
      name: 'Panel rule',
      x: pad,
      y: ruleY,
      width: ruleWidth,
      height: Math.max(1, Math.round(layout.short * 0.0016)),
      fill: palette.cream,
      opacity: 0.5,
    }),
    text({
      text: 'Monday to\nThursday stays',
      x: pad,
      y: detailY,
      width: textWidth,
      fontSize: detailSize,
      fill: palette.cream,
      fontFamily: FONT_BODY,
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.35,
    }),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildPromo10OffCard(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const cardW = layout.w(band(layout, { portrait: 0.78, square: 0.72, wide: 0.48 }));
  const cardH = layout.y(band(layout, { portrait: 0.3, square: 0.34, wide: 0.6 }));
  const cardX = (layout.width - cardW) / 2;
  const cardY = layout.y(band(layout, { portrait: 0.58, square: 0.54, wide: 0.2 }));
  const pad = Math.round(cardW * 0.09);
  return [
    figure({
      name: 'Offer card',
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      fill: palette.cream,
      stroke: palette.ink,
      strokeWidth: 1.5,
      cornerRadius: 18,
      shadowEnabled: true,
      shadowBlur: 32,
      shadowOffsetY: 16,
      shadowColor: '#1c1917',
      shadowOpacity: 0.24,
    }),
    text({
      text: 'Ber Months Promo',
      x: cardX + pad,
      y: cardY + pad * 0.85,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.085),
      fill: palette.ink,
      fontFamily: FONT_LABEL,
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    }),
    text({
      text: '10% off',
      x: cardX + pad,
      y: cardY + cardH * 0.33,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.3),
      fill: palette.ink,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600',
      lineHeight: 1,
      align: 'left',
    }),
    figure({
      name: 'Card rule',
      x: cardX + pad,
      y: cardY + cardH * 0.7,
      width: Math.round((cardW - pad * 2) * 0.3),
      height: Math.max(1, Math.round(layout.short * 0.0016)),
      fill: palette.accent,
    }),
    text({
      text: 'Book direct for this rate.',
      x: cardX + pad,
      y: cardY + cardH * 0.76,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.065),
      fill: palette.ink,
      fontFamily: FONT_BODY,
      fontWeight: '500',
      align: 'left',
    }),
    galleryFooter(binding, layout, palette.cream),
  ];
}

type PerkMarkOptions = {
  eyebrow: string;
  word: string;
  detail: string;
  cta: string;
};

function buildPerkMark(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette,
  options: PerkMarkOptions
): PolotnoChild[] {
  const v = band(layout, {
    portrait: { eyebrow: 0.16, headline: 0.38, detail: 0.56, cta: 0.78 },
    square: { eyebrow: 0.14, headline: 0.36, detail: 0.54, cta: 0.8 },
    wide: { eyebrow: 0.13, headline: 0.42, detail: 0.64, cta: 0.82 },
  });
  const wordRatio = band(layout, { portrait: 0.1, square: 0.105, wide: 0.13 });
  return [
    eyebrow(options.eyebrow, layout, v.eyebrow, palette.cream),
    heroText(options.word, layout, v.headline, wordRatio, palette.cream, {
      italic: true,
      weight: '500',
    }),
    detailText(
      options.detail,
      layout,
      v.detail,
      palette.cream,
      band(layout, { portrait: 0.028, square: 0.03, wide: 0.026 })
    ),
    ...outlinePill(options.cta, layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildPromoFreeBreakfastMark(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  return buildPerkMark(binding, layout, palette, {
    eyebrow: 'Morning Perk',
    word: 'Breakfast',
    detail: 'Included every morning of your stay.',
    cta: 'Select dates',
  });
}

function buildPromoFreeParkingMark(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  return buildPerkMark(binding, layout, palette, {
    eyebrow: 'Stay Perk',
    word: 'Parking',
    detail: 'On-site parking, on us this month.',
    cta: 'Book now',
  });
}

function buildSlots1Countdown(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const slot = binding.openSlots[0] ?? { dateNum: '28', dayName: 'Sat' };
  const v = band(layout, {
    portrait: { eyebrow: 0.11, mark: 0.46, cta: 0.78 },
    square: { eyebrow: 0.1, mark: 0.44, cta: 0.8 },
    wide: { eyebrow: 0.14, mark: 0.5, cta: 0.82 },
  });
  const numeralRatio = band(layout, { portrait: 0.16, square: 0.17, wide: 0.2 });
  return [
    eyebrow(`Last Open Night · ${binding.monthShort}`, layout, v.eyebrow, palette.cream),
    ...dateMark(
      slot.dateNum,
      slot.dayName,
      layout,
      0.5,
      layout.y(v.mark),
      numeralRatio,
      palette.cream
    ),
    ...outlinePill('Book now', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildSlots3Row(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const slots = binding.openSlots.slice(0, 3);
  while (slots.length < 3) {
    slots.push({
      dateNum: `${21 + slots.length * 3}`,
      dayName: ['Fri', 'Sat', 'Sun'][slots.length]!,
    });
  }
  const v = band(layout, {
    portrait: { eyebrow: 0.12, row: 0.42, divider: 0.36, rule: 0.53, cta: 0.78 },
    square: { eyebrow: 0.11, row: 0.4, divider: 0.34, rule: 0.51, cta: 0.8 },
    wide: { eyebrow: 0.13, row: 0.46, divider: 0.38, rule: 0.62, cta: 0.82 },
  });
  const numeralRatio = band(layout, { portrait: 0.09, square: 0.095, wide: 0.115 });
  const centers = [0.27, 0.5, 0.73];
  const rowY = layout.y(v.row);
  return [
    eyebrow(`3 Dates Left · ${binding.monthShort}`, layout, v.eyebrow, palette.cream),
    ...centers.flatMap((cx, i) =>
      dateMark(slots[i]!.dateNum, slots[i]!.dayName, layout, cx, rowY, numeralRatio, palette.cream)
    ),
    thinVRule(layout, 0.385, v.divider, 0.14, palette.cream, 0.35),
    thinVRule(layout, 0.615, v.divider, 0.14, palette.cream, 0.35),
    thinRule(layout, 0.34, v.rule, 0.32, palette.accent),
    ...outlinePill('Book now', layout, 0.34, v.cta, 0.32, 0.058, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildSlots5Strip(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const slots = binding.openSlots.slice(0, 5);
  while (slots.length < 5) {
    slots.push({ dateNum: `${12 + slots.length * 3}`, dayName: '' });
  }
  const v = band(layout, {
    portrait: { eyebrow: 0.12, top: 0.4, bottom: 0.53, cta: 0.78 },
    square: { eyebrow: 0.11, top: 0.38, bottom: 0.51, cta: 0.8 },
    wide: { eyebrow: 0.13, top: 0.44, bottom: 0.6, cta: 0.82 },
  });
  const numeralRatio = band(layout, { portrait: 0.062, square: 0.066, wide: 0.075 });
  const centers = [0, 1, 2, 3, 4].map((i) => 0.14 + i * 0.18);
  const rowY = layout.y((v.top + v.bottom) / 2);
  return [
    eyebrow(`5 Dates Left · ${binding.monthShort}`, layout, v.eyebrow, palette.cream),
    thinRule(layout, 0.09, v.top, 0.82, palette.cream, 0.4),
    ...centers.flatMap((cx, i) =>
      dateMark(slots[i]!.dateNum, slots[i]!.dayName, layout, cx, rowY, numeralRatio, palette.cream)
    ),
    ...centers
      .slice(1)
      .map((cx) =>
        thinVRule(layout, cx - 0.09, v.top + 0.02, v.bottom - v.top - 0.04, palette.cream, 0.28)
      ),
    thinRule(layout, 0.09, v.bottom, 0.82, palette.cream, 0.4),
    ...outlinePill('Book now', layout, 0.34, v.cta, 0.32, 0.058, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildGiveawayEditorial(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const v = band(layout, {
    portrait: { eyebrow: 0.09, headline: 0.16, rule: 0.33, rules: 0.38 },
    square: { eyebrow: 0.08, headline: 0.15, rule: 0.31, rules: 0.36 },
    wide: { eyebrow: 0.08, headline: 0.22, rule: 0.47, rules: 0.53 },
  });
  return [
    eyebrow(`${binding.monthShort} Giveaway`, layout, v.eyebrow, palette.cream),
    heroText(
      'Free 2D1N\nStaycation',
      layout,
      v.headline,
      band(layout, { portrait: 0.076, square: 0.082, wide: 0.088 }),
      palette.cream
    ),
    thinRule(layout, 0.4, v.rule, 0.2, palette.accent),
    text({
      text: '1  Like and follow our page\n2  Tag friends in the comments\n3  Share this post publicly',
      x: layout.pad,
      y: layout.y(v.rules),
      width: layout.width - layout.pad * 2,
      fontSize: layout.font(band(layout, { portrait: 0.03, square: 0.032, wide: 0.03 })),
      fill: palette.cream,
      fontFamily: FONT_BODY,
      fontWeight: '500',
      align: 'center',
      lineHeight: 1.55,
    }),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildGiveawayRaffleTicket(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const cardW = layout.w(band(layout, { portrait: 0.82, square: 0.78, wide: 0.64 }));
  const cardH = layout.y(band(layout, { portrait: 0.42, square: 0.46, wide: 0.68 }));
  const cardX = (layout.width - cardW) / 2;
  const cardY = layout.y(band(layout, { portrait: 0.34, square: 0.3, wide: 0.14 }));
  const dividerXRatio = 0.6;
  const dividerX = cardX + cardW * dividerXRatio;
  const pad = Math.round(cardW * 0.07);
  const rightColWidth = cardW * (1 - dividerXRatio) - pad * 1.2;
  return [
    eyebrow(
      'Staycation Raffle',
      layout,
      band(layout, { portrait: 0.11, square: 0.09, wide: 0.05 }),
      palette.cream
    ),
    figure({
      name: 'Ticket',
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      fill: palette.cream,
      stroke: palette.ink,
      strokeWidth: 1.5,
      cornerRadius: 16,
      shadowEnabled: true,
      shadowBlur: 34,
      shadowOffsetY: 18,
      shadowColor: '#1c0a0a',
      shadowOpacity: 0.32,
    }),
    figure({
      name: 'Ticket divider',
      x: dividerX,
      y: cardY + cardH * 0.12,
      width: Math.max(1, Math.round(layout.short * 0.0018)),
      height: cardH * 0.76,
      fill: palette.ink,
      opacity: 0.3,
    }),
    text({
      text: 'Win a free\n2D1N stay',
      x: cardX + pad,
      y: cardY + cardH * 0.18,
      width: cardW * dividerXRatio - pad * 1.6,
      fontSize: layout.font(band(layout, { portrait: 0.05, square: 0.056, wide: 0.05 })),
      fill: palette.danger,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600',
      align: 'left',
      lineHeight: 1.05,
    }),
    text({
      text: 'Like\nTag friends\nShare',
      x: dividerX + pad * 0.8,
      y: cardY + cardH * 0.22,
      width: rightColWidth,
      fontSize: layout.font(band(layout, { portrait: 0.025, square: 0.027, wide: 0.023 })),
      fill: palette.ink,
      fontFamily: FONT_BODY,
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.6,
    }),
    text({
      text: `Ends ${binding.monthShort}`,
      x: dividerX + pad * 0.8,
      y: cardY + cardH * 0.8,
      width: rightColWidth,
      fontSize: layout.font(0.02),
      fill: palette.ink,
      fontFamily: FONT_LABEL,
      fontWeight: '600',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
      opacity: 0.6,
    }),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildFullyBookedMark(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const boxW = layout.w(band(layout, { portrait: 0.72, square: 0.68, wide: 0.58 }));
  const boxH = layout.y(band(layout, { portrait: 0.16, square: 0.18, wide: 0.32 }));
  const boxX = (layout.width - boxW) / 2;
  const boxY = layout.y(band(layout, { portrait: 0.38, square: 0.36, wide: 0.26 }));
  const labelSize = Math.round(boxH * band(layout, { portrait: 0.32, square: 0.3, wide: 0.24 }));
  return [
    figure({
      name: 'Outer rule',
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      fill: 'rgba(0,0,0,0)',
      stroke: palette.cream,
      strokeWidth: Math.max(1.5, Math.round(layout.short * 0.003)),
      opacity: 0.8,
    }),
    figure({
      name: 'Inner rule',
      x: boxX + Math.round(boxH * 0.08),
      y: boxY + Math.round(boxH * 0.08),
      width: boxW - Math.round(boxH * 0.16),
      height: boxH - Math.round(boxH * 0.16),
      fill: 'rgba(0,0,0,0)',
      stroke: palette.cream,
      strokeWidth: 1,
      opacity: 0.35,
    }),
    text({
      text: 'Fully Booked',
      x: boxX + layout.w(0.02),
      y: Math.round(boxY + boxH / 2 - labelSize * 0.52),
      width: boxW - layout.w(0.04),
      fontSize: labelSize,
      fill: palette.cream,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600',
      letterSpacing: 0.01,
      lineHeight: 1,
    }),
    eyebrow(
      `For ${binding.monthShort}`,
      layout,
      band(layout, { portrait: 0.58, square: 0.58, wide: 0.68 }),
      palette.danger
    ),
    detailText(
      'Watch for next month\u2019s openings.',
      layout,
      band(layout, { portrait: 0.63, square: 0.63, wide: 0.76 }),
      palette.cream,
      band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
    ),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildFullyBookedWaitlistMark(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const v = band(layout, {
    portrait: { eyebrow: 0.15, hero: 0.23, rule: 0.4, detail: 0.44, cta: 0.7 },
    square: { eyebrow: 0.13, hero: 0.21, rule: 0.38, detail: 0.42, cta: 0.72 },
    wide: { eyebrow: 0.1, hero: 0.26, rule: 0.54, detail: 0.6, cta: 0.78 },
  });
  return [
    eyebrow('Fully Booked', layout, v.eyebrow, palette.danger),
    heroText(
      'Waitlist',
      layout,
      v.hero,
      band(layout, { portrait: 0.12, square: 0.13, wide: 0.15 }),
      palette.cream,
      {
        italic: true,
        weight: '500',
      }
    ),
    thinRule(layout, 0.4, v.rule, 0.2, palette.accent),
    detailText(
      'Missed this month? Get first pick of new openings.',
      layout,
      v.detail,
      palette.cream,
      band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
    ),
    ...outlinePill('Join the list', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function reviewFields(binding: DesignBinding) {
  return {
    quote: binding.reviewQuote?.trim() || 'Felt like home the moment we arrived.',
    attribution: binding.reviewAttribution?.trim() || '- Recent guest',
    stars: binding.reviewStars?.trim() || '★★★★★',
  };
}

function buildReviewQuoteCard(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const { quote, attribution, stars } = reviewFields(binding);
  const v = band(layout, {
    portrait: { stars: 0.18, quote: 0.28, rule: 0.62, attr: 0.68, cta: 0.82 },
    square: { stars: 0.16, quote: 0.26, rule: 0.6, attr: 0.66, cta: 0.8 },
    wide: { stars: 0.14, quote: 0.28, rule: 0.58, attr: 0.64, cta: 0.78 },
  });
  return [
    centeredText(
      stars,
      layout,
      v.stars,
      band(layout, { portrait: 0.04, square: 0.042, wide: 0.038 }),
      palette.accent,
      {
        fontFamily: FONT_NUMERAL,
        fontWeight: '600',
        letterSpacing: 0.2,
      }
    ),
    centeredText(
      `“${quote}”`,
      layout,
      v.quote,
      band(layout, { portrait: 0.05, square: 0.052, wide: 0.048 }),
      palette.cream,
      {
        fontFamily: FONT_DISPLAY,
        fontWeight: '500',
        fontStyle: 'italic',
      }
    ),
    thinRule(layout, 0.36, v.rule, 0.22, palette.accent),
    detailText(
      attribution,
      layout,
      v.attr,
      palette.cream,
      band(layout, { portrait: 0.028, square: 0.03, wide: 0.026 })
    ),
    ...outlinePill('Book your stay', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildReviewPhotoQuote(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const { quote, attribution, stars } = reviewFields(binding);
  const v = band(layout, {
    portrait: { stars: 0.52, quote: 0.58, attr: 0.78, cta: 0.86 },
    square: { stars: 0.5, quote: 0.56, attr: 0.76, cta: 0.84 },
    wide: { stars: 0.42, quote: 0.5, attr: 0.7, cta: 0.8 },
  });
  return [
    eyebrow(stars, layout, v.stars, palette.cream),
    centeredText(
      `“${quote}”`,
      layout,
      v.quote,
      band(layout, { portrait: 0.042, square: 0.044, wide: 0.04 }),
      palette.cream,
      {
        fontFamily: FONT_DISPLAY,
        fontWeight: '500',
        fontStyle: 'italic',
      }
    ),
    detailText(
      attribution,
      layout,
      v.attr,
      palette.cream,
      band(layout, { portrait: 0.028, square: 0.03, wide: 0.026 })
    ),
    ...outlinePill('Plan yours', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

function buildReviewStarsStack(
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
): PolotnoChild[] {
  const { quote, attribution, stars } = reviewFields(binding);
  const rating = binding.reviewRating ?? 5;
  const v = band(layout, {
    portrait: { rating: 0.16, stars: 0.32, quote: 0.42, attr: 0.68, cta: 0.82 },
    square: { rating: 0.14, stars: 0.3, quote: 0.4, attr: 0.66, cta: 0.8 },
    wide: { rating: 0.12, stars: 0.28, quote: 0.4, attr: 0.62, cta: 0.78 },
  });
  return [
    heroText(
      `${rating}.0`,
      layout,
      v.rating,
      band(layout, { portrait: 0.12, square: 0.13, wide: 0.14 }),
      palette.cream
    ),
    centeredText(
      stars,
      layout,
      v.stars,
      band(layout, { portrait: 0.036, square: 0.038, wide: 0.034 }),
      palette.accent,
      {
        fontFamily: FONT_NUMERAL,
        fontWeight: '600',
        letterSpacing: 0.18,
      }
    ),
    detailText(
      `“${quote}”`,
      layout,
      v.quote,
      palette.cream,
      band(layout, { portrait: 0.032, square: 0.034, wide: 0.03 })
    ),
    detailText(
      attribution,
      layout,
      v.attr,
      palette.cream,
      band(layout, { portrait: 0.026, square: 0.028, wide: 0.024 })
    ),
    ...outlinePill('Book direct', layout, 0.34, v.cta, 0.32, 0.062, palette.cream),
    galleryFooter(binding, layout, palette.cream),
  ];
}

type CampaignBuilder = (
  binding: DesignBinding,
  layout: CampaignLayout,
  palette: CampaignPalette
) => PolotnoChild[];

const BUILDERS: Record<string, CampaignBuilder> = {
  'promo-500-off': buildPromo500OffPoster,
  'promo-300-off': buildPromo300OffSplit,
  'promo-10-off': buildPromo10OffCard,
  'promo-free-breakfast': buildPromoFreeBreakfastMark,
  'promo-free-parking': buildPromoFreeParkingMark,
  'slots-1': buildSlots1Countdown,
  'slots-3': buildSlots3Row,
  'slots-5': buildSlots5Strip,
  giveaway: buildGiveawayEditorial,
  'giveaway-raffle': buildGiveawayRaffleTicket,
  'fully-booked': buildFullyBookedMark,
  'fully-booked-waitlist': buildFullyBookedWaitlistMark,
  'review-quote': buildReviewQuoteCard,
  'review-photo-quote': buildReviewPhotoQuote,
  'review-stars': buildReviewStarsStack,
};

const CAMPAIGN_SCRIMS: Record<string, Scrim> = {
  'promo-500-off': { r: 20, g: 14, b: 10, top: 0.18, bottom: 0.62 },
  'promo-300-off': { r: 10, g: 9, b: 8, top: 0.08, bottom: 0.55 },
  'promo-10-off': { r: 20, g: 16, b: 12, top: 0.24, bottom: 0.5 },
  'promo-free-breakfast': { r: 26, g: 17, b: 10, top: 0.28, bottom: 0.5 },
  'promo-free-parking': { r: 11, g: 15, b: 22, top: 0.28, bottom: 0.5 },
  'slots-1': { r: 14, g: 14, b: 16, top: 0.3, bottom: 0.58 },
  'slots-3': { r: 20, g: 14, b: 10, top: 0.26, bottom: 0.56 },
  'slots-5': { r: 16, g: 16, b: 18, top: 0.26, bottom: 0.56 },
  giveaway: { r: 30, g: 10, b: 12, top: 0.42, bottom: 0.68 },
  'giveaway-raffle': { r: 30, g: 8, b: 8, top: 0.3, bottom: 0.5 },
  'fully-booked': { r: 12, g: 10, b: 9, top: 0.5, bottom: 0.72 },
  'fully-booked-waitlist': { r: 10, g: 22, b: 20, top: 0.34, bottom: 0.6 },
  'review-quote': { r: 12, g: 18, b: 16, top: 0.22, bottom: 0.58 },
  'review-photo-quote': { r: 18, g: 12, b: 10, top: 0.38, bottom: 0.72 },
  'review-stars': { r: 14, g: 14, b: 12, top: 0.2, bottom: 0.56 },
};

const CAMPAIGN_PAGE_FALLBACKS: Record<string, string> = {
  'promo-500-off': '#57534e',
  'promo-300-off': '#44403c',
  'promo-10-off': '#57534e',
  'promo-free-breakfast': '#6b4423',
  'promo-free-parking': '#374151',
  'slots-1': '#3f3f46',
  'slots-3': '#57534e',
  'slots-5': '#3f3f46',
  giveaway: '#7f1d1d',
  'giveaway-raffle': '#450a0a',
  'fully-booked': '#292524',
  'fully-booked-waitlist': '#134e4a',
  'review-quote': '#134e4a',
  'review-photo-quote': '#57534e',
  'review-stars': '#44403c',
};

export type PolotnoDesignDocument = {
  width: number;
  height: number;
  schemaVersion: number;
  fonts: unknown[];
  pages: Array<{
    id: string;
    background: string;
    children: PolotnoChild[];
  }>;
  custom?: Record<string, unknown>;
};

export function buildPolotnoCampaignDocument(
  templateId: string,
  binding: DesignBinding,
  /** `theme` wins over `brandColor`: palette and the four type roles come from it. */
  options?: { brandColor?: string; theme?: MarketingThemeTokens }
): PolotnoDesignDocument | null {
  const template = getCampaignTemplate(templateId);
  if (!template) return null;

  const baseId = campaignTemplateBaseId(templateId);
  const builder = BUILDERS[baseId];
  if (!builder) return null;

  const { width, height } = DESIGN_FORMAT_DIMENSIONS[template.format];
  const layout = createCampaignLayout(width, height);
  const theme = options?.theme;
  const palette = theme
    ? themeToCampaignPalette(theme)
    : resolveCampaignPalette(options?.brandColor, {
        preservePresetPalette: template.preservePresetPalette,
        presetAccent: template.presetAccent,
      });
  const scrim = CAMPAIGN_SCRIMS[baseId] ?? { r: 15, g: 23, b: 42, top: 0.2, bottom: 0.6 };
  const pageFallback = CAMPAIGN_PAGE_FALLBACKS[baseId] ?? '#78716c';
  resetIds();

  const document: PolotnoDesignDocument = {
    width,
    height,
    schemaVersion: 2,
    fonts: [],
    custom: {
      templateId,
      campaignBaseId: baseId,
      ...(binding.sourceReviewId ? { sourceReviewId: binding.sourceReviewId } : {}),
    },
    pages: [
      {
        id: uid('page'),
        background: campaignPageBackground(
          binding.reviewPhoto || binding.propertyPhoto,
          pageFallback
        ),
        children: [photoScrim(width, height, scrim), ...builder(binding, layout, palette)],
      },
    ],
  };
  if (!theme) return document;
  return applyCampaignFontsToDocument(document, themeCampaignFontMap(theme));
}

/** Quiet Coast faces used by the campaign builders → the theme's type roles. */
export function themeCampaignFontMap(theme: MarketingThemeTokens): Map<string, string> {
  return campaignFontMap(theme, {
    display: FONT_DISPLAY,
    label: FONT_LABEL,
    body: FONT_BODY,
    numeral: FONT_NUMERAL,
  });
}

export function formatDimensions(format: DesignTemplateFormat) {
  return DESIGN_FORMAT_DIMENSIONS[format];
}
