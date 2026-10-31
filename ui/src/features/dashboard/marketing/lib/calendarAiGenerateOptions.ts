import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import type {
  CalendarBackgroundMood,
  CalendarFontPairing,
  CalendarLayoutArchetype,
  CalendarTemplateTokens,
} from '@/features/dashboard/marketing/lib/calendarAiTokens';

export type CalendarAiSuggestion = {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  /** Preview swatches: canvas, available fill, today accent, ink */
  palette: {
    canvas: string;
    available: string;
    today: string;
    ink: string;
  };
};

/** Featured count shown before “View more” in the generate modal. */
export const CALENDAR_AI_SUGGESTIONS_PREVIEW_COUNT = 4;

/**
 * 12 pastel Instagrammable looks — first 4 are featured.
 * Palettes keep mid-depth fills + dark ink so day numbers stay readable.
 */
export const CALENDAR_AI_SUGGESTIONS: CalendarAiSuggestion[] = [
  {
    id: 'blush-petal',
    title: 'Blush petal',
    summary: 'Soft pink · rose today · warm ink',
    palette: {
      canvas: '#fff5f7',
      available: '#f0a8bc',
      today: '#e86b8a',
      ink: '#6b2d42',
    },
    prompt:
      'Blush pink bubble calendar, powder-rose canvas, mid-depth petal available days with warm burgundy date numbers for clarity, deeper rose today accent, soft rounded type, feminine Instagram Story hospitality look',
  },
  {
    id: 'peach-sunrise',
    title: 'Peach sunrise',
    summary: 'Apricot chips · coral today · cocoa ink',
    palette: {
      canvas: '#fff6f0',
      available: '#f0b089',
      today: '#e87a5c',
      ink: '#6b3a28',
    },
    prompt:
      'Peach sunrise availability calendar, apricot cream background, warm peach available chips with cocoa ink dates, coral today ring, clean modern sans, bright vacation-rental Instagram feed energy',
  },
  {
    id: 'butter-weekend',
    title: 'Butter weekend',
    summary: 'Honey yellow · peach accent · cocoa ink',
    palette: {
      canvas: '#fffbeb',
      available: '#e8c56a',
      today: '#f09a6e',
      ink: '#5c3d14',
    },
    prompt:
      'Sunny butter-yellow weekend promo calendar, warm cream canvas, golden honey available days with rich cocoa date numbers, soft peach today accent, playful rounded type, cheerful Instagram getaway vibe',
  },
  {
    id: 'mint-coast',
    title: 'Mint coast',
    summary: 'Seafoam · deep teal · coral accent',
    palette: {
      canvas: '#f2fbf7',
      available: '#7ec8b4',
      today: '#f08a6b',
      ink: '#1a5248',
    },
    prompt:
      'Fresh mint and seafoam calendar, soft aqua wash, rounded available chips with deep teal numbers, coral today highlight, clean sans property name, bright coastal Airbnb Instagram look',
  },
  {
    id: 'sky-linen',
    title: 'Sky linen',
    summary: 'Powder blue · sky chips · navy ink',
    palette: {
      canvas: '#f4f8fc',
      available: '#8eb8dc',
      today: '#f0a070',
      ink: '#243a56',
    },
    prompt:
      'Powder blue linen calendar, airy sky canvas, mid-depth cerulean available days with navy ink numbers, soft apricot today accent, editorial clean type, polished Instagram feed hospitality design',
  },
  {
    id: 'lavender-bubbles',
    title: 'Lavender mist',
    summary: 'Periwinkle · blush today · plum ink',
    palette: {
      canvas: '#faf7ff',
      available: '#b8a6e0',
      today: '#f0a0b8',
      ink: '#3f2a62',
    },
    prompt:
      'Soft lavender bubble calendar, lilac cream card, mid-depth periwinkle available days, plum ink date numbers, blush today accent, elegant tracked property name, Instagram Story pastel hospitality look',
  },
  {
    id: 'matcha-garden',
    title: 'Matcha garden',
    summary: 'Sage green · blush today · forest ink',
    palette: {
      canvas: '#f6faf3',
      available: '#9cbc8e',
      today: '#e8a8b0',
      ink: '#2a452c',
    },
    prompt:
      'Matcha garden calm calendar, ivory-sage background, soft leaf-green available chips with deep forest date numbers, dusty blush today, editorial serif month, quiet luxury stay Instagram aesthetic',
  },
  {
    id: 'coral-reef',
    title: 'Coral reef',
    summary: 'Living coral · sand canvas · wine ink',
    palette: {
      canvas: '#fff8f5',
      available: '#e8987e',
      today: '#d45a6a',
      ink: '#5c2830',
    },
    prompt:
      'Coral reef promo calendar, warm sand-pink canvas, living-coral available days with wine ink numbers, deeper berry today accent, bold friendly sans, tropical Instagram Story rental look',
  },
  {
    id: 'lilac-dusk',
    title: 'Lilac dusk',
    summary: 'Mauve wash · rose today · violet ink',
    palette: {
      canvas: '#f6f0f8',
      available: '#b49ac8',
      today: '#d4849c',
      ink: '#3a2450',
    },
    prompt:
      'Lilac dusk gradient calendar, soft mauve-to-lilac wash, deeper available chips so dark ink stays crisp, rose today accent, elegant serif month title, romantic evening stay Instagram look',
  },
  {
    id: 'aqua-breeze',
    title: 'Aqua breeze',
    summary: 'Turquoise · citrus today · deep teal',
    palette: {
      canvas: '#f0fafb',
      available: '#6eb8c4',
      today: '#f0c060',
      ink: '#184850',
    },
    prompt:
      'Aqua breeze travel calendar, cool mint-teal canvas, turquoise available chips with deep teal ink, sunny citrus today accent, modern clean type, fresh poolside Instagram feed energy',
  },
  {
    id: 'rose-quartz',
    title: 'Rose quartz',
    summary: 'Dusty rose · champagne · burgundy',
    palette: {
      canvas: '#fbf6f4',
      available: '#d4a0a8',
      today: '#c47888',
      ink: '#5a2e38',
    },
    prompt:
      'Rose quartz luxury calendar, champagne-pink canvas, dusty rose available days with burgundy date numbers, deeper mauve today, refined soft sans, boutique hotel Instagram aesthetic',
  },
  {
    id: 'lemon-sherbet',
    title: 'Lemon sherbet',
    summary: 'Citrus cream · lime chip · amber today',
    palette: {
      canvas: '#fffcf0',
      available: '#d4c85a',
      today: '#e89a48',
      ink: '#4a4010',
    },
    prompt:
      'Lemon sherbet sunny calendar, citrus cream background, soft chartreuse-gold available days with olive-brown ink, amber today ring, playful rounded type, cheerful weekend Instagram Story look',
  },
];

export type CalendarAiLayoutOption = {
  value: CalendarLayoutArchetype | 'auto';
  label: string;
  hint: string;
  /** Visual thumbnail kind rendered in the picker */
  preview: 'auto' | 'bubbles' | 'widget' | 'type' | 'geo' | 'garden' | 'photo' | 'dusk';
};

export type CalendarAiFontOption = {
  value: CalendarFontPairing | 'auto';
  label: string;
  hint: string;
  sample: string;
  fontFamily: string;
};

export type CalendarAiBackgroundOption = {
  value: CalendarBackgroundMood | 'auto';
  label: string;
  hint: string;
  preview: 'auto' | 'cream' | 'gradient' | 'dots' | 'photo';
};

export const CALENDAR_AI_LAYOUT_OPTIONS: CalendarAiLayoutOption[] = [
  { value: 'auto', label: 'Auto', hint: 'AI picks', preview: 'auto' },
  { value: 'bubble', label: 'Bubbles', hint: 'Round days', preview: 'bubbles' },
  { value: 'widget', label: 'Widget', hint: 'Card grid', preview: 'widget' },
  { value: 'type-forward', label: 'Type', hint: 'Bold month', preview: 'type' },
  { value: 'geo-pattern', label: 'Geo', hint: 'Shapes', preview: 'geo' },
  { value: 'botanical', label: 'Garden', hint: 'Soft organic', preview: 'garden' },
  { value: 'photo-wash', label: 'Photo', hint: 'Image base', preview: 'photo' },
  { value: 'dusk-gradient', label: 'Dusk', hint: 'Evening wash', preview: 'dusk' },
];

export const CALENDAR_AI_FONT_OPTIONS: CalendarAiFontOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'AI picks',
    sample: 'Aa',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  },
  {
    value: 'soft-sans',
    label: 'Soft',
    hint: 'Friendly sans',
    sample: 'Aa',
    fontFamily: 'Poppins, Plus Jakarta Sans, sans-serif',
  },
  {
    value: 'editorial-serif',
    label: 'Serif',
    hint: 'Editorial',
    sample: 'Aa',
    fontFamily: 'Fraunces, Georgia, serif',
  },
  {
    value: 'playful-rounded',
    label: 'Rounded',
    hint: 'Playful',
    sample: 'Aa',
    fontFamily: 'Nunito, Plus Jakarta Sans, sans-serif',
  },
  {
    value: 'modern-clean',
    label: 'Clean',
    hint: 'Modern',
    sample: 'Aa',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  },
];

export const CALENDAR_AI_BACKGROUND_OPTIONS: CalendarAiBackgroundOption[] = [
  { value: 'auto', label: 'Auto', hint: 'AI picks', preview: 'auto' },
  { value: 'solid-cream', label: 'Cream', hint: 'Solid wash', preview: 'cream' },
  { value: 'soft-gradient', label: 'Gradient', hint: 'Soft blend', preview: 'gradient' },
  { value: 'pattern-dots', label: 'Dots', hint: 'Subtle pattern', preview: 'dots' },
  { value: 'photo-wash', label: 'Photo', hint: 'Property photo', preview: 'photo' },
];

/** What appears on the generated calendar (host-facing; applied client-side). */
export type CalendarAiElements = {
  propertyName: boolean;
  monthYear: boolean;
  navigation: boolean;
  subtitle: boolean;
  dayNames: boolean;
  legend: boolean;
};

export type CalendarAiElementOption = {
  key: keyof CalendarAiElements;
  label: string;
  hint: string;
};

/** Defaults tuned for static social posts (arrows, subtitle, legend off). */
export const DEFAULT_CALENDAR_AI_ELEMENTS: CalendarAiElements = {
  propertyName: true,
  monthYear: true,
  navigation: false,
  subtitle: false,
  dayNames: true,
  legend: false,
};

export const CALENDAR_AI_ELEMENT_OPTIONS: CalendarAiElementOption[] = [
  { key: 'propertyName', label: 'Property name', hint: 'Unit or listing title' },
  { key: 'monthYear', label: 'Month & year', hint: 'Top date label' },
  { key: 'navigation', label: 'Month arrows', hint: 'Prev / next controls' },
  { key: 'subtitle', label: 'Subtitle', hint: 'Line under the month' },
  { key: 'dayNames', label: 'Weekdays', hint: 'Mon, Tue, Wed…' },
  { key: 'legend', label: 'Legend', hint: 'Available / unavailable key' },
];

export type CalendarAiGeneratePreferences = {
  layoutArchetype: CalendarLayoutArchetype | 'auto';
  fontPairing: CalendarFontPairing | 'auto';
  backgroundMood: CalendarBackgroundMood | 'auto';
  elements: CalendarAiElements;
  /** From the “Property colors” Look template — photos when available, else brand. */
  lookPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

export const DEFAULT_CALENDAR_AI_PREFERENCES: CalendarAiGeneratePreferences = {
  layoutArchetype: 'auto',
  fontPairing: 'auto',
  backgroundMood: 'auto',
  elements: DEFAULT_CALENDAR_AI_ELEMENTS,
};

/** Apply host style locks after AI returns (Auto leaves AI choice). */
export function applyCalendarAiPreferencesToTokens(
  tokens: CalendarTemplateTokens,
  preferences: CalendarAiGeneratePreferences
): CalendarTemplateTokens {
  return {
    ...tokens,
    layoutArchetype:
      preferences.layoutArchetype === 'auto' ? tokens.layoutArchetype : preferences.layoutArchetype,
    fontPairing: preferences.fontPairing === 'auto' ? tokens.fontPairing : preferences.fontPairing,
    backgroundMood:
      preferences.backgroundMood === 'auto' ? tokens.backgroundMood : preferences.backgroundMood,
    ...(preferences.lookPalette ? { palette: preferences.lookPalette } : {}),
  };
}

/** Apply show/hide choices after AI styles are compiled. */
export function applyCalendarAiElementsToStyles(
  styles: CalendarStyles,
  elements: CalendarAiElements
): CalendarStyles {
  return {
    ...styles,
    header: {
      ...styles.header,
      propertyName: { ...styles.header.propertyName, show: elements.propertyName },
      monthYear: { ...styles.header.monthYear, show: elements.monthYear },
      navigation: { ...styles.header.navigation, show: elements.navigation },
      subtitle: { ...styles.header.subtitle, show: elements.subtitle },
    },
    dayNames: { ...styles.dayNames, show: elements.dayNames },
    legend: { ...styles.legend, show: elements.legend },
  };
}
