/**
 * AI-generated Polotno design compiler.
 * Converts `DesignTemplateTokens` into a fully editable `PolotnoDesignDocument`
 * using the same primitives as the hand-authored presets.
 */

import {
  normalizeDesignTemplateTokens,
  type DesignBackgroundMood,
  type DesignFontPairing,
  type DesignLayoutArchetype,
  type DesignTemplateTokens,
} from '@/features/dashboard/marketing/lib/designAiTokens';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  band,
  campaignPageBackground,
  centeredText,
  createCampaignLayout,
  figure,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NUMERAL,
  galleryFooter,
  logoImage,
  photoImage,
  photoScrim,
  resetIds,
  text,
  textBoxHeight,
  thinRule,
  uid,
  type CampaignLayout,
  type PolotnoChild,
  type PolotnoDesignDocument,
} from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { roundedOutlineSvgUrl } from '@/features/dashboard/marketing/lib/polotno/roundedOutlineSvg';
import { DESIGN_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/templateRegistry';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

import { mixHexToward, parseHexRgb, type Rgb } from '@/lib/theme/colorConvert';

const FONT_FAMILIES: Record<
  DesignFontPairing,
  { display: string; label: string; body: string; numeral: string }
> = {
  'serif-editorial': {
    display: FONT_DISPLAY,
    label: FONT_LABEL,
    body: FONT_BODY,
    numeral: FONT_NUMERAL,
  },
  'clean-sans': {
    display: FONT_BODY,
    label: FONT_BODY,
    body: FONT_BODY,
    numeral: FONT_NUMERAL,
  },
  'modern-sleek': {
    display: FONT_NUMERAL,
    label: FONT_LABEL,
    body: FONT_BODY,
    numeral: FONT_NUMERAL,
  },
  'rounded-friendly': {
    display: 'Nunito',
    label: 'Nunito',
    body: 'Nunito',
    numeral: 'Nunito',
  },
};

function parseHex(hex: string): Rgb | null {
  return parseHexRgb(hex);
}

function mixHex(base: string, target: Rgb, targetWeight: number): string {
  return mixHexToward(base, target, targetWeight);
}

function mixTowardWhite(hex: string, amount: number): string {
  return mixHex(hex, { r: 255, g: 255, b: 255 }, amount);
}

function mixTowardBlack(hex: string, amount: number): string {
  return mixHex(hex, { r: 0, g: 0, b: 0 }, amount);
}

function relativeLuminance(rgb: Rgb): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function luminance(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? relativeLuminance(rgb) : 0.5;
}

function ensureLight(hex: string): string {
  if (luminance(hex) > 0.85) return hex;
  return mixTowardWhite(hex, 0.72);
}

function ensureDark(hex: string): string {
  if (luminance(hex) < 0.25) return hex;
  return mixTowardBlack(hex, 0.55);
}

function resolveBackground(
  backgroundMood: DesignBackgroundMood,
  primary: string,
  secondary: string,
  accent: string,
  propertyPhoto: string | null
): { background: string; isDark: boolean } {
  if (backgroundMood === 'photo') {
    if (propertyPhoto) return { background: propertyPhoto, isDark: true };
    // Fallback to gradient when no photo is available.
    return {
      background: `linear-gradient(165deg, ${primary}, ${secondary})`,
      isDark: luminance(primary) < 0.5,
    };
  }
  if (backgroundMood === 'solid') {
    return { background: primary, isDark: luminance(primary) < 0.5 };
  }
  if (backgroundMood === 'gradient') {
    const mid = mixHex(secondary, parseHex(accent) ?? { r: 128, g: 128, b: 128 }, 0.22);
    return {
      background: `linear-gradient(165deg, ${primary}, ${mid}, ${secondary})`,
      isDark: luminance(primary) < 0.5,
    };
  }
  // color-wash
  return { background: secondary, isDark: luminance(secondary) < 0.5 };
}

function aiPalette(
  tokens: DesignTemplateTokens,
  propertyPhoto: string | null
): {
  background: string;
  isDark: boolean;
  text: string;
  surface: string;
  accent: string;
  accentDark: string;
  rule: string;
  scrim: { r: number; g: number; b: number; top: number; bottom: number };
  overlay: string;
} {
  const { primary, secondary, accent } = tokens.palette;
  const { background, isDark } = resolveBackground(
    tokens.backgroundMood,
    primary,
    secondary,
    accent,
    propertyPhoto
  );
  const surface = ensureLight(secondary);
  // Text color: dark on light backgrounds, light on dark backgrounds. Force strong contrast.
  const text = isDark ? '#ffffff' : ensureDark(primary);
  const accentDark = mixTowardBlack(accent, 0.18);
  const rule = isDark ? accent : accent;
  const scrimBase = parseHex(primary) ?? { r: 20, g: 20, b: 20 };
  const scrim = {
    r: Math.round(scrimBase.r * 0.18),
    g: Math.round(scrimBase.g * 0.18),
    b: Math.round(scrimBase.b * 0.18),
    top: 0.12,
    bottom: 0.62,
  };
  // Dark overlay used behind bottom text to keep it readable on light gradients.
  const overlay = isDark ? 'rgba(10,10,12,0.32)' : 'rgba(10,10,12,0.55)';
  return {
    background,
    isDark,
    text,
    surface,
    accent,
    accentDark,
    rule,
    scrim,
    overlay,
  };
}

/** Bottom-anchored gradient overlay that darkens the lower area so footer + CTA stay readable. */
function gradientOverlay(
  layout: CampaignLayout,
  direction: 'bottom' | 'top',
  palette: ReturnType<typeof aiPalette>
): PolotnoChild {
  const gradient =
    direction === 'bottom'
      ? `linear-gradient(180deg, transparent, ${palette.overlay})`
      : `linear-gradient(180deg, ${palette.overlay}, transparent)`;
  return {
    id: uid('gradient-overlay'),
    type: 'figure',
    subType: 'rect',
    name: 'Gradient overlay',
    x: 0,
    y: direction === 'bottom' ? layout.y(0.55) : 0,
    width: layout.width,
    height: layout.y(0.45),
    fill: gradient,
    locked: false,
    selectable: true,
  };
}

function textOptionsForFont(
  fontPairing: DesignFontPairing,
  role: 'display' | 'label' | 'body' | 'numeral'
): { fontFamily: string } {
  const fonts = FONT_FAMILIES[fontPairing];
  let family = FONT_BODY;
  if (role === 'display') family = fonts.display;
  if (role === 'label') family = fonts.label;
  if (role === 'body') family = fonts.body;
  if (role === 'numeral') family = fonts.numeral;
  return { fontFamily: family };
}

function aiEyebrow(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fill: string,
  fontPairing: DesignFontPairing,
  fontRatio = 0.03
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    ...textOptionsForFont(fontPairing, 'label'),
    fontWeight: '500',
    letterSpacing: 0.16,
    textTransform: 'uppercase',
  });
}

function aiHero(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fontRatio: number,
  fill: string,
  fontPairing: DesignFontPairing,
  options?: {
    italic?: boolean;
    weight?: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
  }
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    ...textOptionsForFont(fontPairing, 'display'),
    fontStyle: options?.italic ? 'italic' : 'normal',
    fontWeight: options?.weight ?? '600',
    lineHeight: 1.02,
    width: options?.width,
    align: options?.align,
  });
}

function aiDetail(
  copy: string,
  layout: CampaignLayout,
  topRatio: number,
  fill: string,
  fontPairing: DesignFontPairing,
  fontRatio = 0.032
): PolotnoChild {
  return centeredText(copy, layout, topRatio, fontRatio, fill, {
    ...textOptionsForFont(fontPairing, 'body'),
    fontWeight: '500',
    lineHeight: 1.3,
  });
}

function aiOutlinePill(
  copy: string,
  layout: CampaignLayout,
  leftRatio: number,
  topRatio: number,
  widthRatio: number,
  heightRatio: number,
  color: string,
  fontPairing: DesignFontPairing
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
      ...textOptionsForFont(fontPairing, 'label'),
      fontWeight: '600',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
    }),
  ];
}

function buildHeroPhoto(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const v = band(layout, {
    portrait: {
      eyebrow: 0.1,
      headline: 0.18,
      subheadline: 0.32,
      rule: 0.4,
      detail: 0.44,
      cta: 0.78,
    },
    square: { eyebrow: 0.09, headline: 0.16, subheadline: 0.3, rule: 0.38, detail: 0.42, cta: 0.8 },
    wide: { eyebrow: 0.08, headline: 0.2, subheadline: 0.36, rule: 0.54, detail: 0.6, cta: 0.82 },
  });
  const headlineRatio = band(layout, { portrait: 0.11, square: 0.12, wide: 0.14 });
  const children: PolotnoChild[] = [];
  // Add a bottom gradient overlay so footer and CTA stay readable on light gradients.
  children.push(gradientOverlay(layout, 'bottom', palette));
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }
  children.push(
    aiEyebrow(tokens.copy.eyebrow, layout, v.eyebrow, palette.text, tokens.fontPairing)
  );
  children.push(
    aiHero(
      tokens.copy.headline,
      layout,
      v.headline,
      headlineRatio,
      palette.text,
      tokens.fontPairing
    )
  );
  if (tokens.copy.subheadline) {
    children.push(
      aiDetail(
        tokens.copy.subheadline,
        layout,
        v.subheadline,
        palette.text,
        tokens.fontPairing,
        band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
      )
    );
  }
  children.push(thinRule(layout, 0.4, v.rule, 0.2, palette.rule));
  children.push(
    aiDetail(
      tokens.copy.detail,
      layout,
      v.detail,
      palette.text,
      tokens.fontPairing,
      band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
    )
  );
  if (options.cta) {
    children.push(
      ...aiOutlinePill(
        tokens.copy.cta,
        layout,
        0.34,
        v.cta,
        0.32,
        0.062,
        palette.text,
        tokens.fontPairing
      )
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, palette.text));
  }
  return children;
}

function buildSplitPanel(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const panelWidthRatio = band(layout, { portrait: 0.5, square: 0.48, wide: 0.4 });
  const panelWidth = layout.w(panelWidthRatio);
  const pad = Math.round(panelWidth * 0.14);
  const textWidth = panelWidth - pad * 2;
  // Use a deepened primary for the panel so light text is always readable.
  const panelColor = mixTowardBlack(tokens.palette.primary, 0.42);
  const panelText = ensureLight(panelColor);
  const children: PolotnoChild[] = [
    figure({
      name: 'Accent panel',
      x: 0,
      y: 0,
      width: panelWidth,
      height: layout.height,
      fill: panelColor,
    }),
    figure({
      name: 'Panel seam',
      x: panelWidth - 1,
      y: 0,
      width: Math.max(1, Math.round(layout.short * 0.0016)),
      height: layout.height,
      fill: panelText,
      opacity: 0.4,
    }),
  ];
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }

  const eyebrowSize = layout.font(band(layout, { portrait: 0.024, square: 0.026, wide: 0.026 }));
  const headlineSize = layout.font(band(layout, { portrait: 0.074, square: 0.072, wide: 0.1 }));
  const detailSize = layout.font(band(layout, { portrait: 0.028, square: 0.03, wide: 0.026 }));

  let cursor = layout.y(band(layout, { portrait: 0.14, square: 0.13, wide: 0.16 }));
  const eyebrowY = cursor;
  cursor += textBoxHeight(eyebrowSize, 1) + Math.round(headlineSize * 0.55);
  const headlineY = cursor;
  const headlineBoxHeight = textBoxHeight(headlineSize, 2, 0.98);
  cursor += headlineBoxHeight + Math.round(headlineSize * 0.32);
  const ruleY = cursor;
  cursor += Math.round(layout.short * 0.028);
  const detailY = cursor;

  children.push(
    text({
      text: tokens.copy.eyebrow,
      x: pad,
      y: eyebrowY,
      width: textWidth,
      fontSize: eyebrowSize,
      fill: panelText,
      ...textOptionsForFont(tokens.fontPairing, 'label'),
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    }),
    text({
      text: tokens.copy.headline,
      x: pad,
      y: headlineY,
      width: textWidth,
      fontSize: headlineSize,
      fill: panelText,
      ...textOptionsForFont(tokens.fontPairing, 'display'),
      fontWeight: '600',
      lineHeight: 0.98,
      align: 'left',
    }),
    figure({
      name: 'Panel rule',
      x: pad,
      y: ruleY,
      width: Math.round(textWidth * 0.5),
      height: Math.max(1, Math.round(layout.short * 0.0016)),
      fill: panelText,
      opacity: 0.5,
    }),
    text({
      text: tokens.copy.detail,
      x: pad,
      y: detailY,
      width: textWidth,
      fontSize: detailSize,
      fill: panelText,
      ...textOptionsForFont(tokens.fontPairing, 'body'),
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.35,
    })
  );
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, palette.text));
  }
  return children;
}

function buildCenteredCard(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const cardW = layout.w(band(layout, { portrait: 0.78, square: 0.72, wide: 0.48 }));
  const cardH = layout.y(band(layout, { portrait: 0.36, square: 0.4, wide: 0.68 }));
  const cardX = (layout.width - cardW) / 2;
  const cardY = layout.y(band(layout, { portrait: 0.5, square: 0.46, wide: 0.16 }));
  const pad = Math.round(cardW * 0.09);
  const textColor = ensureDark(palette.surface);
  const children: PolotnoChild[] = [];
  children.push(gradientOverlay(layout, 'bottom', palette));
  children.push(
    figure({
      name: 'Offer card',
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      fill: palette.surface,
      stroke: textColor,
      strokeWidth: 1.5,
      cornerRadius: 18,
      shadowEnabled: true,
      shadowBlur: 32,
      shadowOffsetY: 16,
      shadowColor: '#1c1917',
      shadowOpacity: 0.24,
    })
  );
  children.push(
    text({
      text: tokens.copy.eyebrow,
      x: cardX + pad,
      y: cardY + pad * 0.85,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.085),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'label'),
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    })
  );
  children.push(
    text({
      text: tokens.copy.headline,
      x: cardX + pad,
      y: cardY + cardH * 0.3,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.26),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'display'),
      fontWeight: '600',
      lineHeight: 1,
      align: 'left',
    })
  );
  children.push(
    figure({
      name: 'Card rule',
      x: cardX + pad,
      y: cardY + cardH * 0.62,
      width: Math.round((cardW - pad * 2) * 0.3),
      height: Math.max(1, Math.round(layout.short * 0.0016)),
      fill: palette.accent,
    })
  );
  children.push(
    text({
      text: tokens.copy.detail,
      x: cardX + pad,
      y: cardY + cardH * 0.68,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.065),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'body'),
      fontWeight: '500',
      align: 'left',
    })
  );
  if (options.cta) {
    children.push(
      text({
        text: tokens.copy.cta,
        x: cardX + pad,
        y: cardY + cardH * 0.85,
        width: cardW - pad * 2,
        fontSize: Math.round(cardH * 0.055),
        fill: palette.accent,
        ...textOptionsForFont(tokens.fontPairing, 'label'),
        fontWeight: '600',
        letterSpacing: 0.12,
        textTransform: 'uppercase',
        align: 'left',
      })
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, palette.text));
  }
  return children;
}

function buildEditorialMinimal(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const v = band(layout, {
    portrait: { eyebrow: 0.12, headline: 0.22, rule: 0.38, detail: 0.43, cta: 0.78 },
    square: { eyebrow: 0.11, headline: 0.2, rule: 0.36, detail: 0.41, cta: 0.8 },
    wide: { eyebrow: 0.1, headline: 0.26, rule: 0.52, detail: 0.58, cta: 0.82 },
  });
  const headlineRatio = band(layout, { portrait: 0.1, square: 0.11, wide: 0.13 });
  const textColor = palette.text;
  const children: PolotnoChild[] = [];
  children.push(gradientOverlay(layout, 'bottom', palette));
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }
  children.push(aiEyebrow(tokens.copy.eyebrow, layout, v.eyebrow, textColor, tokens.fontPairing));
  children.push(
    aiHero(tokens.copy.headline, layout, v.headline, headlineRatio, textColor, tokens.fontPairing)
  );
  children.push(thinRule(layout, 0.4, v.rule, 0.2, palette.accent));
  children.push(
    aiDetail(
      tokens.copy.detail,
      layout,
      v.detail,
      textColor,
      tokens.fontPairing,
      band(layout, { portrait: 0.03, square: 0.032, wide: 0.028 })
    )
  );
  if (options.cta) {
    children.push(
      ...aiOutlinePill(
        tokens.copy.cta,
        layout,
        0.34,
        v.cta,
        0.32,
        0.062,
        textColor,
        tokens.fontPairing
      )
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, textColor));
  }
  return children;
}

function buildGradientFrame(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const cardW = layout.w(band(layout, { portrait: 0.82, square: 0.76, wide: 0.52 }));
  const cardH = layout.y(band(layout, { portrait: 0.42, square: 0.46, wide: 0.74 }));
  const cardX = (layout.width - cardW) / 2;
  const cardY = layout.y(band(layout, { portrait: 0.46, square: 0.42, wide: 0.14 }));
  const frame = Math.round(layout.short * 0.02);
  const textColor = ensureDark(palette.surface);
  const children: PolotnoChild[] = [];
  children.push(
    figure({
      name: 'Gradient frame',
      x: cardX - frame,
      y: cardY - frame,
      width: cardW + frame * 2,
      height: cardH + frame * 2,
      fill: `linear-gradient(135deg, ${tokens.palette.accent}, ${tokens.palette.primary})`,
      cornerRadius: 24,
      shadowEnabled: true,
      shadowBlur: 28,
      shadowOffsetY: 12,
      shadowColor: '#1c1917',
      shadowOpacity: 0.22,
    })
  );
  children.push(
    figure({
      name: 'Inner card',
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      fill: palette.surface,
      cornerRadius: 18,
    })
  );
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }
  const pad = Math.round(cardW * 0.09);
  children.push(
    text({
      text: tokens.copy.eyebrow,
      x: cardX + pad,
      y: cardY + pad * 0.9,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.075),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'label'),
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    }),
    text({
      text: tokens.copy.headline,
      x: cardX + pad,
      y: cardY + cardH * 0.26,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.23),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'display'),
      fontWeight: '600',
      lineHeight: 1,
      align: 'left',
    }),
    text({
      text: tokens.copy.detail,
      x: cardX + pad,
      y: cardY + cardH * 0.58,
      width: cardW - pad * 2,
      fontSize: Math.round(cardH * 0.06),
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'body'),
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.35,
    })
  );
  if (options.cta) {
    children.push(
      text({
        text: tokens.copy.cta,
        x: cardX + pad,
        y: cardY + cardH * 0.8,
        width: cardW - pad * 2,
        fontSize: Math.round(cardH * 0.05),
        fill: tokens.palette.accent,
        ...textOptionsForFont(tokens.fontPairing, 'label'),
        fontWeight: '600',
        letterSpacing: 0.12,
        textTransform: 'uppercase',
        align: 'left',
      })
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, palette.text));
  }
  return children;
}

function buildPhotoBottom(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const photoHeightRatio = band(layout, { portrait: 0.52, square: 0.48, wide: 0.5 });
  const photoHeight = layout.y(photoHeightRatio);
  const textAreaHeight = layout.height - photoHeight;
  const children: PolotnoChild[] = [];
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }
  const textColor = palette.text;
  const pad = layout.pad;
  const textWidth = layout.width - pad * 2;
  const eyebrowSize = layout.font(band(layout, { portrait: 0.026, square: 0.028, wide: 0.024 }));
  const headlineSize = layout.font(band(layout, { portrait: 0.08, square: 0.09, wide: 0.1 }));
  const detailSize = layout.font(band(layout, { portrait: 0.032, square: 0.034, wide: 0.028 }));
  let cursor = pad + textAreaHeight * 0.12;
  children.push(
    text({
      text: tokens.copy.eyebrow,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: eyebrowSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'label'),
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    })
  );
  cursor += textBoxHeight(eyebrowSize, 1) + headlineSize * 0.35;
  children.push(
    text({
      text: tokens.copy.headline,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: headlineSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'display'),
      fontWeight: '600',
      lineHeight: 1,
      align: 'left',
    })
  );
  cursor += textBoxHeight(headlineSize, 2, 1) + detailSize * 0.5;
  children.push(
    text({
      text: tokens.copy.detail,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: detailSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'body'),
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.35,
    })
  );
  if (options.propertyPhoto && options.propertyPhotoUrl) {
    children.push(
      photoImage(
        options.propertyPhotoUrl,
        0,
        photoHeight,
        layout.width,
        layout.height - photoHeight
      ),
      {
        id: uid('photo-fade'),
        type: 'figure',
        subType: 'rect',
        name: 'Photo fade',
        x: 0,
        y: photoHeight,
        width: layout.width,
        height: layout.height - photoHeight,
        fill: `linear-gradient(180deg, ${palette.background}, transparent)`,
        locked: false,
        selectable: true,
      }
    );
  }
  if (options.cta) {
    children.push(
      ...aiOutlinePill(
        tokens.copy.cta,
        layout,
        0.06,
        band(layout, { portrait: 0.88, square: 0.86, wide: 0.88 }),
        0.32,
        0.055,
        textColor,
        tokens.fontPairing
      )
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, textColor));
  }
  return children;
}

function buildLeftStack(
  binding: DesignBinding,
  layout: CampaignLayout,
  tokens: DesignTemplateTokens,
  palette: ReturnType<typeof aiPalette>,
  options: CampaignBuilderOptions
): PolotnoChild[] {
  const children: PolotnoChild[] = [];
  children.push(gradientOverlay(layout, 'bottom', palette));
  if (options.orgLogo && options.orgLogoUrl) {
    children.push(logoImage(options.orgLogoUrl, layout, 0.04, 0.055));
  }
  const pad = layout.pad;
  const textWidth = layout.width - pad * 2;
  const eyebrowSize = layout.font(band(layout, { portrait: 0.026, square: 0.028, wide: 0.024 }));
  const headlineSize = layout.font(band(layout, { portrait: 0.088, square: 0.09, wide: 0.11 }));
  const detailSize = layout.font(band(layout, { portrait: 0.032, square: 0.034, wide: 0.028 }));
  const textColor = palette.text;
  let cursor = layout.y(band(layout, { portrait: 0.16, square: 0.14, wide: 0.18 }));
  children.push(
    text({
      text: tokens.copy.eyebrow,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: eyebrowSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'label'),
      fontWeight: '500',
      letterSpacing: 0.14,
      textTransform: 'uppercase',
      align: 'left',
    })
  );
  cursor += textBoxHeight(eyebrowSize, 1) + headlineSize * 0.35;
  children.push(
    text({
      text: tokens.copy.headline,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: headlineSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'display'),
      fontWeight: '600',
      lineHeight: 1,
      align: 'left',
    })
  );
  cursor += textBoxHeight(headlineSize, 2, 1) + detailSize * 0.5;
  children.push(
    text({
      text: tokens.copy.detail,
      x: pad,
      y: cursor,
      width: textWidth,
      fontSize: detailSize,
      fill: textColor,
      ...textOptionsForFont(tokens.fontPairing, 'body'),
      fontWeight: '500',
      align: 'left',
      lineHeight: 1.35,
    })
  );
  children.push(
    figure({
      name: 'Accent rule',
      x: pad,
      y: cursor + textBoxHeight(detailSize, 2, 1.35) + layout.size(0.03),
      width: layout.w(0.18),
      height: Math.max(2, Math.round(layout.short * 0.004)),
      fill: tokens.palette.accent,
    })
  );
  if (options.cta) {
    children.push(
      ...aiOutlinePill(
        tokens.copy.cta,
        layout,
        0.06,
        band(layout, { portrait: 0.78, square: 0.76, wide: 0.78 }),
        0.32,
        0.055,
        textColor,
        tokens.fontPairing
      )
    );
  }
  if (options.propertyName) {
    children.push(galleryFooter(binding, layout, textColor));
  }
  return children;
}

type CampaignBuilderOptions = ResolveAiGeneratedDesignOptions & {
  propertyPhoto: boolean;
  orgLogo: boolean;
  propertyName: boolean;
  cta: boolean;
};

const ARCHETYPE_BUILDERS: Record<
  DesignLayoutArchetype,
  (
    binding: DesignBinding,
    layout: CampaignLayout,
    tokens: DesignTemplateTokens,
    palette: ReturnType<typeof aiPalette>,
    options: CampaignBuilderOptions
  ) => PolotnoChild[]
> = {
  'hero-photo': buildHeroPhoto,
  'split-panel': buildSplitPanel,
  'centered-card': buildCenteredCard,
  'editorial-minimal': buildEditorialMinimal,
  'gradient-frame': buildGradientFrame,
  'photo-bottom': buildPhotoBottom,
  'left-stack': buildLeftStack,
};

export type ResolveAiGeneratedDesignOptions = {
  brandColor?: string;
  propertyPhotoUrl?: string | null;
  orgLogoUrl?: string | null;
  includeCta?: boolean;
  includePropertyName?: boolean;
  includeOrgLogo?: boolean;
};

function uniquePageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `page-${crypto.randomUUID()}`;
  }
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compile AI tokens into a PolotnoDesignDocument for one format. */
export function resolveAiGeneratedDesignDocument(
  binding: DesignBinding,
  tokensInput: Partial<DesignTemplateTokens>,
  format: DesignTemplateFormat,
  options?: ResolveAiGeneratedDesignOptions
): PolotnoDesignDocument {
  const tokens = normalizeDesignTemplateTokens(tokensInput);
  const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
  const layout = createCampaignLayout(width, height);
  const builder = ARCHETYPE_BUILDERS[tokens.layoutArchetype];
  resetIds();

  const photoUrl = options?.propertyPhotoUrl?.trim() || null;
  const includeOptions = {
    propertyPhoto: Boolean(photoUrl),
    orgLogo: options?.includeOrgLogo !== false && Boolean(options?.orgLogoUrl?.trim()),
    propertyName: options?.includePropertyName !== false,
    cta: options?.includeCta !== false,
  };

  // Host include-photo wins over the AI's backgroundMood. photo-bottom keeps the
  // photo as a region so the top band can stay a solid/gradient.
  const usePhotoAsPageBackground = Boolean(photoUrl) && tokens.layoutArchetype !== 'photo-bottom';
  const backgroundMood: DesignBackgroundMood = usePhotoAsPageBackground
    ? 'photo'
    : tokens.backgroundMood === 'photo' && !photoUrl
      ? 'gradient'
      : tokens.backgroundMood;
  const effectiveTokens: DesignTemplateTokens = {
    ...tokens,
    backgroundMood,
  };
  const palette = aiPalette(effectiveTokens, usePhotoAsPageBackground ? photoUrl : null);

  const pageBackground = usePhotoAsPageBackground && photoUrl ? photoUrl : palette.background;

  const children: PolotnoChild[] = [];
  if (usePhotoAsPageBackground && photoUrl) {
    children.push(photoScrim(width, height, palette.scrim));
  }
  children.push(
    ...builder(binding, layout, effectiveTokens, palette, { ...options, ...includeOptions })
  );

  return {
    width,
    height,
    schemaVersion: 2,
    fonts: [],
    custom: {
      templateId: '',
      aiGenerated: true,
      aiTokens: tokens,
    },
    pages: [
      {
        id: uniquePageId(),
        background: campaignPageBackground(pageBackground, palette.background),
        children,
      },
    ],
  };
}

export const DESIGN_AI_FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-story',
  'facebook-post',
];

/** One AI design → three format-ready Polotno documents (no extra AI calls). */
export function resolveAiGeneratedDesignDocumentsForAllFormats(
  binding: DesignBinding,
  tokensInput: Partial<DesignTemplateTokens>,
  options?: ResolveAiGeneratedDesignOptions
): Array<{ format: DesignTemplateFormat; document: PolotnoDesignDocument }> {
  return DESIGN_AI_FORMATS.map((format) => ({
    format,
    document: resolveAiGeneratedDesignDocument(binding, tokensInput, format, options),
  }));
}
