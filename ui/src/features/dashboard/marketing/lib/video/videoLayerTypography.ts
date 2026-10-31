import type { CSSProperties } from 'react';

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type {
  VideoLayerTypography,
  VideoSceneLayer,
  VideoTextStyle,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type {
  VideoFontRole,
  VideoTypographyContext,
} from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

/** Fonts preloaded in ui/index.html — safe for Remotion preview + export. */
export const VIDEO_FONT_FAMILIES = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Jost', label: 'Jost' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Sora', label: 'Sora' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'Inter Tight', label: 'Inter Tight' },
  { value: 'Figtree', label: 'Figtree' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Fraunces', label: 'Fraunces' },
  { value: 'Lora', label: 'Lora' },
  { value: 'system-ui', label: 'System' },
] as const;

export type VideoTextPresetId = VideoFontRole;

/**
 * Size / weight / spacing stay role-driven; `fontFamily` is a fallback that the
 * project's template font pairing replaces at resolve time.
 */
export const VIDEO_TEXT_PRESETS: Record<
  VideoTextPresetId,
  {
    label: string;
    textStyle: VideoTextStyle;
    typography: Omit<VideoLayerTypography, 'color' | 'backgroundColor'>;
  }
> = {
  title: {
    label: 'Title',
    textStyle: 'headline',
    typography: {
      fontFamily: 'Fraunces',
      fontSize: 48,
      fontWeight: 600,
      letterSpacing: 1,
      lineHeight: 1.12,
      textTransform: 'uppercase',
      strokeColor: null,
      strokeWidth: 0,
      shadow: true,
    },
  },
  subtitle: {
    label: 'Subtitle',
    textStyle: 'subheadline',
    typography: {
      fontFamily: 'Jost',
      fontSize: 28,
      fontWeight: 500,
      letterSpacing: 2,
      lineHeight: 1.25,
      textTransform: 'uppercase',
      strokeColor: null,
      strokeWidth: 0,
      shadow: true,
    },
  },
  promo: {
    label: 'Promo',
    textStyle: 'promo',
    typography: {
      fontFamily: 'Fraunces',
      fontSize: 72,
      fontWeight: 600,
      letterSpacing: -0.5,
      lineHeight: 1.05,
      textTransform: 'none',
      strokeColor: null,
      strokeWidth: 0,
      shadow: true,
    },
  },
  body: {
    label: 'Body',
    textStyle: 'body',
    typography: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 30,
      fontWeight: 500,
      letterSpacing: 0,
      lineHeight: 1.3,
      textTransform: 'none',
      strokeColor: null,
      strokeWidth: 0,
      shadow: true,
    },
  },
  label: {
    label: 'Label',
    textStyle: 'footer',
    typography: {
      fontFamily: 'Jost',
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: 2,
      lineHeight: 1.2,
      textTransform: 'uppercase',
      strokeColor: null,
      strokeWidth: 0,
      shadow: true,
    },
  },
  cta: {
    label: 'CTA',
    textStyle: 'body',
    typography: {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 26,
      fontWeight: 600,
      letterSpacing: 0.5,
      lineHeight: 1,
      textTransform: 'none',
      strokeColor: null,
      strokeWidth: 0,
      shadow: false,
    },
  },
};

function presetColors(
  preset: VideoTextPresetId,
  palette: CampaignPalette
): Pick<VideoLayerTypography, 'color' | 'backgroundColor'> {
  const light = palette.cream;
  if (preset === 'cta') {
    // Outline CTAs use cream for border + label; filled CTAs keep ink on cream.
    return { color: palette.ink, backgroundColor: light };
  }
  // Titles / promo / body stay light on photo — never brand-brown with shadow.
  return { color: light, backgroundColor: null };
}

export function typographyPresetForLayer(layer: VideoSceneLayer): VideoTextPresetId {
  return presetIdForLayer(layer.textStyle ?? 'headline', layer.kind);
}

function presetIdForLayer(style: VideoTextStyle, kind: VideoSceneLayer['kind']): VideoTextPresetId {
  if (kind === 'cta') return 'cta';
  switch (style) {
    case 'subheadline':
      return 'subtitle';
    case 'promo':
      return 'promo';
    case 'footer':
      return 'label';
    case 'body':
      return 'body';
    default:
      return 'title';
  }
}

function baseTypographyForStyle(
  style: VideoTextStyle,
  kind: VideoSceneLayer['kind'],
  context: VideoTypographyContext
): VideoLayerTypography {
  return buildTypographyFromPreset(presetIdForLayer(style, kind), context);
}

export function resolveLayerTypography(
  layer: VideoSceneLayer,
  context: VideoTypographyContext
): VideoLayerTypography {
  const base = baseTypographyForStyle(layer.textStyle ?? 'headline', layer.kind, context);
  if (!layer.typography) return base;
  return { ...base, ...layer.typography };
}

export function buildTypographyFromPreset(
  presetId: VideoTextPresetId,
  context: VideoTypographyContext
): VideoLayerTypography {
  const preset = VIDEO_TEXT_PRESETS[presetId];
  const look = context.look;
  const sizeScale =
    presetId === 'title'
      ? (look.titleScale ?? 1)
      : presetId === 'promo'
        ? (look.promoScale ?? 1)
        : 1;
  const titleOverrides =
    presetId === 'title'
      ? {
          ...(look.titleLetterSpacing !== undefined
            ? { letterSpacing: look.titleLetterSpacing }
            : null),
          ...(look.titleFontWeight !== undefined ? { fontWeight: look.titleFontWeight } : null),
        }
      : null;

  return {
    ...preset.typography,
    fontFamily: context.fontPairing[presetId] ?? preset.typography.fontFamily,
    fontSize: Math.round(preset.typography.fontSize * sizeScale),
    ...presetColors(presetId, context.palette),
    ...titleOverrides,
  };
}

export function typographyToCss(
  typography: VideoLayerTypography,
  scale: number,
  options?: { isCta?: boolean; ctaChrome?: 'filled' | 'outline' }
): CSSProperties {
  const fontSize = Math.round(typography.fontSize * scale);
  const strokeWidth = typography.strokeWidth ?? 0;
  const strokeColor = typography.strokeColor;

  const style: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize,
    fontWeight: typography.fontWeight,
    color: typography.color,
    lineHeight: typography.lineHeight ?? 1.15,
    letterSpacing: typography.letterSpacing ? `${typography.letterSpacing * scale}px` : undefined,
    textTransform: typography.textTransform ?? 'none',
    textShadow: typography.shadow ? '0 2px 16px rgba(0,0,0,0.45)' : undefined,
  };

  if (strokeWidth > 0 && strokeColor) {
    style.WebkitTextStroke = `${Math.max(1, Math.round(strokeWidth * scale))}px ${strokeColor}`;
  }

  if (options?.isCta) {
    const padY = Math.round(14 * scale);
    const padX = Math.round(36 * scale);
    const light = typography.backgroundColor || typography.color || '#fff7eb';
    if (options.ctaChrome === 'outline') {
      return {
        ...style,
        backgroundColor: 'transparent',
        color: light,
        border: `${Math.max(2, Math.round(2 * scale))}px solid ${light}`,
        borderRadius: 999,
        padding: `${padY}px ${padX}px`,
        display: 'inline-block',
      };
    }
    if (typography.backgroundColor) {
      return {
        ...style,
        backgroundColor: typography.backgroundColor,
        color: typography.color,
        borderRadius: 999,
        padding: `${padY}px ${padX}px`,
        display: 'inline-block',
      };
    }
  }

  return style;
}
