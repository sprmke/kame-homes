import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import { themeToCampaignPalette } from '@/features/dashboard/marketing/lib/theme/designThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  resolveVideoTemplateLayout,
  type VideoCtaChrome,
  type VideoPillStyle,
} from '@/features/dashboard/marketing/lib/video/videoTemplateLayouts';
import { videoTemplatePalette } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

/** Text roles shared by the preset table and the per-template pairings. */
export type VideoFontRole = 'title' | 'subtitle' | 'promo' | 'body' | 'label' | 'cta';

export type VideoFontPairing = Record<VideoFontRole, string>;

/**
 * At-rest visual identity. Quiet Coast Motion: soft scrims + refined type.
 */
export type VideoTemplateLook = {
  scrimAccentMix: number;
  scrimBottomOpacity: number;
  titleLetterSpacing?: number;
  titleFontWeight?: number;
  titleScale?: number;
  promoScale?: number;
  pillStyle: VideoPillStyle;
  ctaChrome: VideoCtaChrome;
};

/** Quiet Coast Motion default pairing (matches Design). */
export const DEFAULT_VIDEO_FONT_PAIRING: VideoFontPairing = {
  title: 'Fraunces',
  subtitle: 'Jost',
  promo: 'Fraunces',
  body: 'Plus Jakarta Sans',
  label: 'Jost',
  cta: 'Plus Jakarta Sans',
};

export const DEFAULT_VIDEO_TEMPLATE_LOOK: VideoTemplateLook = {
  scrimAccentMix: 0.35,
  scrimBottomOpacity: 0.62,
  titleLetterSpacing: 1,
  titleFontWeight: 600,
  pillStyle: 'outline',
  ctaChrome: 'outline',
};

/** Light per-template variation on the Quiet Coast base. */
const VIDEO_TEMPLATE_FONT_PAIRINGS: Record<string, VideoFontPairing> = {
  'quiet-morning': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'golden-hour': {
    title: 'Cormorant Garamond',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'poolside-calm': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Cormorant Garamond',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'amenity-tour': {
    title: 'Jost',
    subtitle: 'Fraunces',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'weekday-cut': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Space Grotesk',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'percent-off': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'rainy-day-rate': {
    title: 'Lora',
    subtitle: 'Jost',
    promo: 'Space Grotesk',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'one-left': {
    title: 'Cormorant Garamond',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'three-dates': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'this-weekend': {
    title: 'Space Grotesk',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'guest-love': {
    title: 'Fraunces',
    subtitle: 'Fraunces',
    promo: 'Jost',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'stay-again': {
    title: 'Cormorant Garamond',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'sold-out-stamp': {
    title: 'Lora',
    subtitle: 'Jost',
    promo: 'Lora',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'join-waitlist': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Plus Jakarta Sans',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'ber-months': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Cormorant Garamond',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'holiday-glow': {
    title: 'Cormorant Garamond',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  // AI-generated storyboards (`videoAiProjectBuilder.ts`) use one of these four
  // ids as their VideoProject.templateId so the existing typography/motion
  // resolution pipeline picks up the host's chosen font pairing unchanged.
  'ai-editorial-serif': {
    title: 'Fraunces',
    subtitle: 'Jost',
    promo: 'Fraunces',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'ai-cinematic-serif': {
    title: 'Cormorant Garamond',
    subtitle: 'Jost',
    promo: 'Cormorant Garamond',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'ai-modern-sans': {
    title: 'Space Grotesk',
    subtitle: 'Jost',
    promo: 'Space Grotesk',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
  'ai-warm-serif': {
    title: 'Lora',
    subtitle: 'Jost',
    promo: 'Lora',
    body: 'Plus Jakarta Sans',
    label: 'Jost',
    cta: 'Plus Jakarta Sans',
  },
};

const VIDEO_TEMPLATE_LOOKS: Record<
  string,
  Pick<VideoTemplateLook, 'scrimAccentMix' | 'scrimBottomOpacity'> &
    Partial<
      Pick<
        VideoTemplateLook,
        | 'titleLetterSpacing'
        | 'titleFontWeight'
        | 'pillStyle'
        | 'ctaChrome'
        | 'titleScale'
        | 'promoScale'
      >
    >
> = {
  'quiet-morning': { scrimAccentMix: 0.25, scrimBottomOpacity: 0.58 },
  'golden-hour': { scrimAccentMix: 0.4, scrimBottomOpacity: 0.64, titleLetterSpacing: 2 },
  'poolside-calm': { scrimAccentMix: 0.2, scrimBottomOpacity: 0.55, titleScale: 1.1 },
  'amenity-tour': { scrimAccentMix: 0.3, scrimBottomOpacity: 0.6 },
  'weekday-cut': {
    scrimAccentMix: 0.55,
    scrimBottomOpacity: 0.72,
    promoScale: 1.15,
    ctaChrome: 'filled',
  },
  'percent-off': { scrimAccentMix: 0.5, scrimBottomOpacity: 0.75, titleLetterSpacing: 3 },
  'rainy-day-rate': { scrimAccentMix: 0.45, scrimBottomOpacity: 0.7 },
  'one-left': {
    scrimAccentMix: 0.15,
    scrimBottomOpacity: 0.7,
    pillStyle: 'bare',
    titleScale: 1.2,
  },
  'three-dates': { scrimAccentMix: 0.35, scrimBottomOpacity: 0.68, pillStyle: 'compact' },
  'this-weekend': {
    scrimAccentMix: 0.55,
    scrimBottomOpacity: 0.74,
    ctaChrome: 'filled',
    titleFontWeight: 700,
  },
  'guest-love': {
    scrimAccentMix: 0.3,
    scrimBottomOpacity: 0.65,
    titleScale: 0.85,
    promoScale: 0.55,
  },
  'stay-again': { scrimAccentMix: 0.28, scrimBottomOpacity: 0.6 },
  'sold-out-stamp': { scrimAccentMix: 0.12, scrimBottomOpacity: 0.68, titleLetterSpacing: 3 },
  'join-waitlist': { scrimAccentMix: 0.35, scrimBottomOpacity: 0.66, ctaChrome: 'filled' },
  'ber-months': { scrimAccentMix: 0.4, scrimBottomOpacity: 0.7 },
  'holiday-glow': { scrimAccentMix: 0.55, scrimBottomOpacity: 0.72, titleLetterSpacing: 2 },
  // AI-generated storyboards (`videoAiProjectBuilder.ts`) — each font pairing also carries
  // a distinct look so the 4 choices feel like genuinely different templates, not just
  // different type on an identical frame.
  'ai-editorial-serif': { scrimAccentMix: 0.3, scrimBottomOpacity: 0.62, pillStyle: 'outline' },
  'ai-cinematic-serif': {
    scrimAccentMix: 0.18,
    scrimBottomOpacity: 0.56,
    pillStyle: 'bare',
    titleScale: 1.12,
    titleLetterSpacing: 1.5,
  },
  'ai-modern-sans': {
    scrimAccentMix: 0.5,
    scrimBottomOpacity: 0.72,
    pillStyle: 'filled',
    ctaChrome: 'filled',
    titleScale: 0.92,
    titleFontWeight: 700,
  },
  'ai-warm-serif': {
    scrimAccentMix: 0.38,
    scrimBottomOpacity: 0.66,
    pillStyle: 'compact',
    titleScale: 1.05,
    promoScale: 1.1,
  },
};

export type VideoTypographyContext = {
  palette: CampaignPalette;
  fontPairing: VideoFontPairing;
  look: VideoTemplateLook;
};

export function resolveVideoFontPairing(templateId: string | undefined): VideoFontPairing {
  if (!templateId) return DEFAULT_VIDEO_FONT_PAIRING;
  return VIDEO_TEMPLATE_FONT_PAIRINGS[templateId] ?? DEFAULT_VIDEO_FONT_PAIRING;
}

export function resolveVideoTemplateLook(templateId: string | undefined): VideoTemplateLook {
  const layout = resolveVideoTemplateLayout(templateId);
  const base = !templateId
    ? DEFAULT_VIDEO_TEMPLATE_LOOK
    : (VIDEO_TEMPLATE_LOOKS[templateId] ?? DEFAULT_VIDEO_TEMPLATE_LOOK);

  return {
    ...DEFAULT_VIDEO_TEMPLATE_LOOK,
    ...base,
    // Recipe/look wins over legacy layout chrome when set.
    pillStyle: base.pillStyle ?? layout.pillStyle,
    ctaChrome: base.ctaChrome ?? layout.ctaChrome,
    titleScale: base.titleScale ?? layout.titleScale,
    promoScale: base.promoScale ?? layout.promoScale,
  };
}

/** Template text roles → theme type roles (big type uses display, small caps use label). */
const VIDEO_ROLE_TO_THEME_ROLE: Record<VideoFontRole, 'display' | 'label' | 'body'> = {
  title: 'display',
  promo: 'display',
  subtitle: 'label',
  label: 'label',
  body: 'body',
  cta: 'body',
};

export function themeVideoFontPairing(theme: MarketingThemeTokens): VideoFontPairing {
  const pairing = {} as VideoFontPairing;
  for (const role of Object.keys(VIDEO_ROLE_TO_THEME_ROLE) as VideoFontRole[]) {
    pairing[role] = theme.fonts[VIDEO_ROLE_TO_THEME_ROLE[role]];
  }
  return pairing;
}

/**
 * Colors, fonts and look for a video. With a theme, palette and fonts come from
 * it (a per-project AI look palette still wins); the template keeps its craft
 * (scrims, scale, pill and CTA style) either way.
 */
export function resolveVideoTypographyContext(
  templateId: string | undefined,
  brandColor?: string,
  paletteOverride?: CampaignPalette | null,
  theme?: MarketingThemeTokens | null
): VideoTypographyContext {
  return {
    palette:
      paletteOverride ??
      (theme ? themeToCampaignPalette(theme) : videoTemplatePalette(templateId ?? '', brandColor)),
    fontPairing: theme ? themeVideoFontPairing(theme) : resolveVideoFontPairing(templateId),
    look: resolveVideoTemplateLook(templateId),
  };
}
