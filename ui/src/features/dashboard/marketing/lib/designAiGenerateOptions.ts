import type {
  DesignBackgroundMood,
  DesignCampaignCategory,
  DesignFontPairing,
  DesignLayoutArchetype,
  DesignTemplateTokens,
} from '@/features/dashboard/marketing/lib/designAiTokens';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';

export type DesignAiSuggestion = {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

/** Featured count shown before “View more” in the generate modal. */
export const DESIGN_AI_SUGGESTIONS_PREVIEW_COUNT = 4;

/**
 * 12 editorial design looks — first 4 are featured.
 * Palettes stay in the Quiet Coast system (warm, muted, never neon).
 */
export const DESIGN_AI_SUGGESTIONS: DesignAiSuggestion[] = [
  {
    id: 'quiet-coast',
    title: 'Quiet Coast',
    summary: 'Teal · cream · terracotta accent',
    palette: { primary: '#24a88e', secondary: '#fff7eb', accent: '#e8752a' },
    prompt:
      'Quiet Coast editorial promo design: teal wash, warm cream card, terracotta accent rule, Fraunces headline, tracked-caps Jost label, calm luxury hospitality feel, Instagram post',
  },
  {
    id: 'blush-villa',
    title: 'Blush Villa',
    summary: 'Dusty rose · champagne · wine',
    palette: { primary: '#d4a0a8', secondary: '#fbf6f4', accent: '#5a2e38' },
    prompt:
      'Blush villa romantic promo design: dusty rose gradient, champagne cream surface, wine ink headline, boutique hotel elegance, no shapes, clean typography, Instagram Story',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    summary: 'Amber · sand · cocoa ink',
    palette: { primary: '#e8c56a', secondary: '#fffbeb', accent: '#6b3a28' },
    prompt:
      'Golden hour getaway design: amber wash, soft sand surface, cocoa ink headline, warm friendly rounded type, vacation rental energy, no stars or badges, Instagram post',
  },
  {
    id: 'sea-glass',
    title: 'Sea Glass',
    summary: 'Aqua · mint · coral accent',
    palette: { primary: '#6eb8c4', secondary: '#f0fafb', accent: '#f09a6e' },
    prompt:
      'Sea glass coastal promo design: cool aqua gradient, mint-cream surface, coral accent rule, modern sans headline, poolside Airbnb vibe, clean editorial layout, Instagram Story',
  },
  {
    id: 'lavender-dusk',
    title: 'Lavender Dusk',
    summary: 'Mauve · lilac · plum ink',
    palette: { primary: '#b49ac8', secondary: '#f6f0f8', accent: '#3a2450' },
    prompt:
      'Lavender dusk evening stay design: mauve-to-lilac wash, soft cream surface, plum ink headline, elegant serif, romantic hospitality mood, Instagram post',
  },
  {
    id: 'coral-reef',
    title: 'Coral Reef',
    summary: 'Living coral · sand · wine',
    palette: { primary: '#e8987e', secondary: '#fff8f5', accent: '#d45a6a' },
    prompt:
      'Coral reef tropical promo design: warm sand background, living coral surface, wine ink headline, friendly rounded type, tropical vacation rental feel, Instagram Story',
  },
  {
    id: 'matcha-garden',
    title: 'Matcha Garden',
    summary: 'Sage · ivory · forest ink',
    palette: { primary: '#9cbc8e', secondary: '#f6faf3', accent: '#2a452c' },
    prompt:
      'Matcha garden calm stay design: sage green wash, ivory surface, forest ink headline, editorial serif, quiet luxury nature retreat, no shapes, Instagram post',
  },
  {
    id: 'midnight-promo',
    title: 'Midnight Promo',
    summary: 'Charcoal · cream · gold accent',
    palette: { primary: '#2a2a35', secondary: '#f5f5f0', accent: '#d4a843' },
    prompt:
      'Midnight promo design: charcoal background, warm cream surface, gold accent rule, elegant serif headline, bold luxury announcement, no neon, Instagram Story',
  },
  {
    id: 'sky-linen',
    title: 'Sky Linen',
    summary: 'Powder blue · white · navy',
    palette: { primary: '#8eb8dc', secondary: '#f4f8fc', accent: '#243a56' },
    prompt:
      'Sky linen airy promo design: powder blue wash, white surface, navy ink headline, clean sans type, polished Instagram feed hospitality design, no badges',
  },
  {
    id: 'peach-sunrise',
    title: 'Peach Sunrise',
    summary: 'Apricot · cream · cocoa',
    palette: { primary: '#f0b089', secondary: '#fff6f0', accent: '#6b3a28' },
    prompt:
      'Peach sunrise morning promo design: apricot cream background, soft peach surface, cocoa ink headline, modern clean sans, bright vacation rental energy, Instagram post',
  },
  {
    id: 'rose-quartz',
    title: 'Rose Quartz',
    summary: 'Dusty rose · champagne · burgundy',
    palette: { primary: '#d4a0a8', secondary: '#fbf6f4', accent: '#5a2e38' },
    prompt:
      'Rose quartz luxury giveaway design: champagne-pink surface, dusty rose background, burgundy ink headline, refined soft serif, boutique hotel aesthetic, Instagram Story',
  },
  {
    id: 'aqua-breeze',
    title: 'Aqua Breeze',
    summary: 'Turquoise · citrus · deep teal',
    palette: { primary: '#6eb8c4', secondary: '#fffcf0', accent: '#184850' },
    prompt:
      'Aqua breeze travel promo design: cool mint-teal background, citrus cream surface, deep teal ink headline, modern sans, fresh poolside Instagram feed energy, no shapes',
  },
];

export type DesignAiLayoutOption = {
  value: DesignLayoutArchetype | 'auto';
  label: string;
  hint: string;
  preview:
    'auto' | 'hero' | 'split' | 'card' | 'editorial' | 'frame' | 'photo-bottom' | 'left-stack';
};

export type DesignAiFontOption = {
  value: DesignFontPairing | 'auto';
  label: string;
  hint: string;
  sample: string;
  fontFamily: string;
};

export type DesignAiBackgroundOption = {
  value: DesignBackgroundMood | 'auto';
  label: string;
  hint: string;
  preview: 'auto' | 'photo' | 'solid' | 'gradient' | 'wash';
};

export const DESIGN_AI_LAYOUT_OPTIONS: DesignAiLayoutOption[] = [
  { value: 'auto', label: 'Auto', hint: 'AI picks', preview: 'auto' },
  { value: 'hero-photo', label: 'Hero photo', hint: 'Photo-led headline', preview: 'hero' },
  { value: 'split-panel', label: 'Split panel', hint: 'Color side panel', preview: 'split' },
  { value: 'centered-card', label: 'Centered card', hint: 'Card surface', preview: 'card' },
  {
    value: 'editorial-minimal',
    label: 'Editorial minimal',
    hint: 'Type-only',
    preview: 'editorial',
  },
  { value: 'gradient-frame', label: 'Gradient frame', hint: 'Framed card', preview: 'frame' },
  {
    value: 'photo-bottom',
    label: 'Photo bottom',
    hint: 'Photo lower half',
    preview: 'photo-bottom',
  },
  { value: 'left-stack', label: 'Left stack', hint: 'Left-aligned text', preview: 'left-stack' },
];

export const DESIGN_AI_FONT_OPTIONS: DesignAiFontOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'AI picks',
    sample: 'Aa',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  },
  {
    value: 'serif-editorial',
    label: 'Serif',
    hint: 'Editorial',
    sample: 'Aa',
    fontFamily: 'Fraunces, Georgia, serif',
  },
  {
    value: 'clean-sans',
    label: 'Clean',
    hint: 'Modern sans',
    sample: 'Aa',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  },
  {
    value: 'modern-sleek',
    label: 'Sleek',
    hint: 'Geometric',
    sample: 'Aa',
    fontFamily: 'Space Grotesk, Plus Jakarta Sans, sans-serif',
  },
  {
    value: 'rounded-friendly',
    label: 'Rounded',
    hint: 'Friendly',
    sample: 'Aa',
    fontFamily: 'Nunito, Plus Jakarta Sans, sans-serif',
  },
];

export const DESIGN_AI_BACKGROUND_OPTIONS: DesignAiBackgroundOption[] = [
  { value: 'auto', label: 'Auto', hint: 'AI picks', preview: 'auto' },
  { value: 'photo', label: 'Photo', hint: 'Property photo', preview: 'photo' },
  { value: 'solid', label: 'Solid', hint: 'Single color', preview: 'solid' },
  { value: 'gradient', label: 'Gradient', hint: 'Soft blend', preview: 'gradient' },
  { value: 'color-wash', label: 'Wash', hint: 'Light tint', preview: 'wash' },
];

export const DESIGN_AI_DEFAULT_CONTENTS: Record<DesignCampaignCategory, string> = {
  promo:
    'Promotional offer: highlight a discount or special deal, create urgency, and drive direct bookings.',
  slots:
    'Last slots alert: emphasize limited remaining availability and encourage guests to book the last open dates.',
  giveaway:
    'Giveaway: invite guests to enter a contest or drawing for a chance to win a free stay.',
  'fully-booked':
    'Fully booked: let guests know the month is full and invite them to join a waitlist for future openings.',
  reviews:
    'Guest review social post: highlight a five-star quote, guest name, and stars to build trust for direct bookings.',
  custom: '',
};

export type DesignAiGeneratePreferences = {
  layoutArchetype: DesignLayoutArchetype | 'auto';
  fontPairing: DesignFontPairing | 'auto';
  backgroundMood: DesignBackgroundMood | 'auto';
  category: DesignCampaignCategory;
  content: string;
  /** From the “Property colors” Look template — photos when available, else brand. */
  lookPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

export const DEFAULT_DESIGN_AI_PREFERENCES: DesignAiGeneratePreferences = {
  layoutArchetype: 'auto',
  fontPairing: 'auto',
  backgroundMood: 'auto',
  category: 'promo',
  content: DESIGN_AI_DEFAULT_CONTENTS.promo,
};

/** Apply host style locks after AI returns (Auto leaves AI choice). */
export function applyDesignAiPreferencesToTokens(
  tokens: DesignTemplateTokens,
  preferences: DesignAiGeneratePreferences
): DesignTemplateTokens {
  return {
    ...tokens,
    layoutArchetype:
      preferences.layoutArchetype === 'auto' ? tokens.layoutArchetype : preferences.layoutArchetype,
    fontPairing: preferences.fontPairing === 'auto' ? tokens.fontPairing : preferences.fontPairing,
    backgroundMood:
      preferences.backgroundMood === 'auto' ? tokens.backgroundMood : preferences.backgroundMood,
    category: preferences.category,
    ...(preferences.lookPalette ? { palette: preferences.lookPalette } : {}),
  };
}

export type DesignAiIncludeKey = 'propertyPhoto' | 'orgLogo' | 'propertyName' | 'cta';

export const DESIGN_AI_INCLUDE_OPTIONS: Array<{
  key: DesignAiIncludeKey;
  label: string;
  hint: string;
}> = [
  {
    key: 'propertyPhoto',
    label: 'Property photo',
    hint: 'Use a property photo as the background or a design element',
  },
  {
    key: 'orgLogo',
    label: 'Org logo',
    hint: 'Include the organization logo in the design',
  },
  {
    key: 'propertyName',
    label: 'Property name',
    hint: 'Display the property name in the footer or header',
  },
  {
    key: 'cta',
    label: 'Call-to-action',
    hint: 'Add a CTA button or pill with the generated action text',
  },
];

export type DesignAiIncludeContext = Record<DesignAiIncludeKey, boolean>;

export const DEFAULT_DESIGN_AI_INCLUDE_CONTEXT: DesignAiIncludeContext = {
  propertyPhoto: true,
  orgLogo: true,
  propertyName: true,
  cta: true,
};

export type DesignAiGenerateResult = {
  tokens: DesignTemplateTokens;
  documents: Array<{
    format: 'instagram-post' | 'instagram-story' | 'facebook-post';
    document: PolotnoDesignDocument;
  }>;
  aiGenerationId: string;
};
