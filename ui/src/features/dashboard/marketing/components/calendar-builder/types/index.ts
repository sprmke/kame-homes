// Calendar Builder Types - Comprehensive styling configuration

import { calendarBrandPalette } from '@/features/dashboard/marketing/lib/calendarBrandTints';
import {
  createDefaultCanvasFrame,
  normalizeCalendarCanvasFrame,
  type CalendarCanvasFrameStyles,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

export type { CalendarCanvasFrameStyles };

// ========================================
// Font Configuration
// ========================================
export interface FontConfig {
  family: string;
  size: number;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight: number;
  letterSpacing: number;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

// ========================================
// Border Configuration
// ========================================
export interface BorderConfig {
  width: number;
  style: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  color: string;
  radius: number;
}

// ========================================
// Shadow Configuration
// ========================================
export interface ShadowConfig {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

// ========================================
// Spacing Configuration
// ========================================
export interface SpacingConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ========================================
// Background Configuration
// ========================================
export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  color: string;
  gradient?: {
    type: 'linear' | 'radial';
    angle: number; // For linear gradient
    stops: Array<{
      color: string;
      position: number; // 0-100
    }>;
  };
  // New simplified image properties (preferred)
  imageUrl?: string;
  imageSize?: 'cover' | 'contain' | 'auto' | string;
  imagePosition?: string;
  overlay?: string; // Overlay color with opacity, e.g. 'rgba(255,255,255,0.85)'
  opacity?: number;
  // Legacy image object (for backward compatibility)
  image?: {
    url: string;
    size: 'cover' | 'contain' | 'auto' | string;
    position: string;
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
    opacity: number;
  };
  pattern?: {
    type: 'dots' | 'grid' | 'lines' | 'diagonal' | 'none';
    color: string;
    size: number;
    opacity: number;
  };
}

// ========================================
// Calendar Container Styles
// ========================================
export interface CalendarContainerStyles {
  background: BackgroundConfig;
  border: BorderConfig;
  shadow: ShadowConfig;
  padding: SpacingConfig;
  maxWidth: number;
  borderRadius: number;
}

// ========================================
// Calendar Header Styles
// ========================================
export interface CalendarHeaderStyles {
  show: boolean;
  background: BackgroundConfig;
  padding: SpacingConfig;
  border: BorderConfig;

  // Title styles
  title: {
    show: boolean;
    font: FontConfig;
    color: string;
    alignment: 'left' | 'center' | 'right';
  };

  // Subtitle/Description
  subtitle: {
    show: boolean;
    text: string;
    font: FontConfig;
    color: string;
  };

  // Property name display
  propertyName: {
    show: boolean;
    font: FontConfig;
    color: string;
  };

  // Month/Year display
  monthYear: {
    show: boolean;
    format: 'MMMM YYYY' | 'MMM YYYY' | 'MM/YYYY' | 'YYYY-MM';
    font: FontConfig;
    color: string;
  };

  // Navigation buttons
  navigation: {
    show: boolean;
    buttonBackground: string;
    buttonColor: string;
    buttonBorder: BorderConfig;
    buttonSize: number;
    hoverBackground: string;
    hoverColor: string;
  };
}

// ========================================
// Day Names Header Styles (Sun, Mon, Tue, etc.)
// ========================================
export interface DayNamesStyles {
  show: boolean;
  background: BackgroundConfig;
  font: FontConfig;
  color: string;
  padding: SpacingConfig;
  border: BorderConfig;
  alignment: 'left' | 'center' | 'right';
  format: 'full' | 'short' | 'narrow'; // Sunday, Sun, S
}

// ========================================
// Calendar Grid Styles
// ========================================
export interface CalendarGridStyles {
  gap: number;
  padding: SpacingConfig;
  background: BackgroundConfig;
  border: BorderConfig;
  borderRadius: number;
}

// ========================================
// Calendar Cell Styles (Individual Day Cell)
// ========================================
export interface CalendarCellStyles {
  minHeight: number;
  padding: SpacingConfig;
  border: BorderConfig;
  borderRadius: number;
  background: BackgroundConfig;

  // Day number styling
  dayNumber: {
    font: FontConfig;
    color: string;
    position: 'top-left' | 'top-center' | 'top-right' | 'center';
    padding: SpacingConfig;
  };

  // Hover state
  hover: {
    enabled: boolean;
    background: string;
    borderColor: string;
    scale: number;
    shadow: ShadowConfig;
    transition: number; // ms
  };

  // Empty cell (days from other months)
  empty: {
    background: BackgroundConfig;
    opacity: number;
  };
}

// ========================================
// Today Highlight Styles
// ========================================
export interface TodayStyles {
  enabled: boolean;
  background: BackgroundConfig;
  border: BorderConfig;
  dayNumberColor: string;
  dayNumberBackground: string;
  indicator: {
    show: boolean;
    type: 'dot' | 'ring' | 'underline' | 'badge';
    color: string;
    size: number;
  };
}

// ========================================
// Booked State Styles
// ========================================
export interface BookedStateStyles {
  background: BackgroundConfig;
  dayNumberColor: string;
  border: BorderConfig;

  // Text overlay
  text: {
    show: boolean;
    content: string; // e.g., "BOOKED", "OCCUPIED"
    font: FontConfig;
    color: string;
    position: 'center' | 'bottom' | 'top';
  };

  // Icon/Image overlay
  icon: {
    show: boolean;
    type: 'icon' | 'image';
    value: string; // Icon name or image URL
    size: number;
    color: string;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number;
  };

  // Pattern overlay
  pattern: {
    show: boolean;
    type: 'stripes' | 'dots' | 'cross' | 'diagonal' | 'none';
    color: string;
    opacity: number;
    size: number;
  };

  // Guest name display (for detailed view)
  guestInfo: {
    show: boolean;
    font: FontConfig;
    color: string;
    truncate: boolean;
  };
}

// ========================================
// Available State Styles
// ========================================
export interface AvailableStateStyles {
  background: BackgroundConfig;
  dayNumberColor: string;
  border: BorderConfig;

  // Price display
  price: {
    show: boolean;
    font: FontConfig;
    color: string;
    position: 'bottom' | 'center' | 'top-right';
    format: 'currency' | 'plain'; // ₱1,000 vs 1000
    currency: string;
  };

  // Available indicator
  indicator: {
    show: boolean;
    type: 'text' | 'icon' | 'dot';
    value: string;
    color: string;
  };
}

// ========================================
// Blocked State Styles
// ========================================
export interface BlockedStateStyles {
  background: BackgroundConfig;
  dayNumberColor: string;
  border: BorderConfig;

  // Text overlay
  text: {
    show: boolean;
    content: string; // e.g., "BLOCKED", "N/A"
    font: FontConfig;
    color: string;
  };

  // Pattern overlay
  pattern: {
    show: boolean;
    type: 'stripes' | 'cross' | 'diagonal' | 'none';
    color: string;
    opacity: number;
  };

  // Icon overlay
  icon: {
    show: boolean;
    type: 'icon' | 'image';
    value: string;
    size: number;
    color: string;
    opacity: number;
  };
}

// ========================================
// Booking Span/Bar Styles (Multi-day bookings)
// ========================================
export interface BookingBarStyles {
  show: boolean;
  height: number;
  borderRadius: number;
  background: BackgroundConfig;
  border: BorderConfig;

  // Text inside bar
  text: {
    show: boolean;
    font: FontConfig;
    color: string;
    truncate: boolean;
  };

  // Color coding by status
  statusColors: {
    confirmed: string;
    checkedIn: string;
    pending: string;
    checkout: string;
  };
}

// ========================================
// Legend Styles
// ========================================
export interface LegendStyles {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  background: BackgroundConfig;
  padding: SpacingConfig;
  border: BorderConfig;
  borderRadius: number;

  // Item styles
  item: {
    gap: number;
    labelFont: FontConfig;
    labelColor: string;
    indicatorSize: number;
    indicatorBorderRadius: number;
  };

  // Title
  title: {
    show: boolean;
    text: string;
    font: FontConfig;
    color: string;
  };
}

// ========================================
// Watermark Styles
// ========================================
export interface WatermarkStyles {
  show: boolean;
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  font?: FontConfig;
  color: string;
  opacity: number;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size: number;
}

// ========================================
// Complete Calendar Style Configuration
// ========================================
export interface CalendarStyles {
  // Metadata
  id?: string;
  name: string;
  description?: string;
  version: number;

  // Main sections
  container: CalendarContainerStyles;
  header: CalendarHeaderStyles;
  dayNames: DayNamesStyles;
  grid: CalendarGridStyles;
  cell: CalendarCellStyles;

  // States
  today: TodayStyles;
  booked: BookedStateStyles;
  available: AvailableStateStyles;
  blocked: BlockedStateStyles;

  // Additional elements
  bookingBar: BookingBarStyles;
  legend: LegendStyles;
  watermark: WatermarkStyles;

  /** Outer export canvas (square / portrait / landscape story frames). */
  canvasFrame: CalendarCanvasFrameStyles;
}

export function normalizeCalendarStyles(styles: CalendarStyles): CalendarStyles {
  return {
    ...styles,
    canvasFrame: normalizeCalendarCanvasFrame(styles.canvasFrame),
  };
}

// ========================================
// Preset Themes
// ========================================
export type CalendarPreset =
  | 'default'
  | 'social-availability'
  | 'sunrise-select'
  | 'desk-type'
  | 'magazine-grid'
  | 'bauhaus-geo'
  | 'memphis-print'
  | 'boho-soft'
  | 'garden-glow'
  | 'property-hero'
  | 'cabin-retreat'
  | 'velvet-guest'
  | 'gold-foil'
  | 'ring-bloom'
  | 'petal-note'
  | 'custom';

// ========================================
// Calendar Builder State
// ========================================
export interface CalendarBuilderState {
  styles: CalendarStyles;
  activeSection: string | null;
  activeSubSection: string | null;
  previewMonth: Date;
  isDirty: boolean;
  isExporting: boolean;
  exportFormat: 'png' | 'jpeg' | 'webp';
  exportQuality: number;
  history: CalendarStyles[];
  historyIndex: number;
}

// ========================================
// Mock Booking Data for Preview
// ========================================
export interface PreviewBooking {
  id: string;
  guestName: string;
  startDay: number;
  endDay: number;
  status: 'confirmed' | 'checkedIn' | 'pending' | 'checkout';
  color?: string;
}

// ========================================
// Booking for Calendar View (date-based)
// ========================================
export interface CalendarBooking {
  id: string;
  bookingNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: string;
  amount: number;
}

// ========================================
// Font Options — Premium serifs, sans & geometric families (loaded in index.html)
// ========================================
export const FONT_FAMILIES = [
  // Editorial serifs
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Fraunces', label: 'Fraunces' },
  { value: 'Lora', label: 'Lora' },
  // Premium sans serif
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Sora', label: 'Sora' },
  { value: 'Jost', label: 'Jost' },
  // Modern / geometric sans
  { value: 'Inter Tight', label: 'Inter Tight' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'Figtree', label: 'Figtree' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
  // Classic sans
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  // System
  { value: 'system-ui', label: 'System Default' },
] as const;

// ========================================
// Default Styles Factory - Professional Clean Design
// ========================================
export function createDefaultStyles(brandColor?: string): CalendarStyles {
  const primaryFont = 'DM Sans';
  const brand = calendarBrandPalette(brandColor);

  return {
    name: 'Custom Calendar',
    version: 1,

    container: {
      background: {
        type: 'solid',
        color: '#ffffff',
      },
      border: {
        width: 1,
        style: 'solid',
        color: '#e2e8f0',
        radius: 20,
      },
      shadow: {
        enabled: true,
        x: 0,
        y: 8,
        blur: 32,
        spread: -8,
        color: 'rgba(0, 0, 0, 0.12)',
        inset: false,
      },
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      maxWidth: 900,
      borderRadius: 20,
    },

    header: {
      show: true,
      background: {
        type: 'solid',
        color: 'transparent',
      },
      padding: { top: 0, right: 0, bottom: 20, left: 0 },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 0,
      },
      title: {
        show: true,
        font: {
          family: primaryFont,
          size: 24,
          weight: 600,
          lineHeight: 1.2,
          letterSpacing: -0.3,
          textTransform: 'none',
        },
        color: '#1e293b',
        alignment: 'left',
      },
      subtitle: {
        show: false,
        text: '',
        font: {
          family: primaryFont,
          size: 15,
          weight: 400,
          lineHeight: 1.5,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#64748b',
      },
      propertyName: {
        show: true,
        font: {
          family: primaryFont,
          size: 25,
          weight: 500,
          lineHeight: 1.5,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: brand.brand,
      },
      monthYear: {
        show: true,
        format: 'MMMM YYYY',
        font: {
          family: primaryFont,
          size: 40,
          weight: 600,
          lineHeight: 1.3,
          letterSpacing: -0.2,
          textTransform: 'none',
        },
        color: '#1e293b',
      },
      navigation: {
        show: false,
        buttonBackground: '#f1f5f9',
        buttonColor: '#475569',
        buttonBorder: {
          width: 0,
          style: 'none',
          color: 'transparent',
          radius: 10,
        },
        buttonSize: 38,
        hoverBackground: '#e2e8f0',
        hoverColor: '#1e293b',
      },
    },

    dayNames: {
      show: true,
      background: {
        type: 'solid',
        color: 'transparent',
      },
      font: {
        family: primaryFont,
        size: 13,
        weight: 600,
        lineHeight: 1.5,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      },
      color: '#94a3b8',
      padding: { top: 12, right: 4, bottom: 12, left: 4 },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 0,
      },
      alignment: 'center',
      format: 'short',
    },

    grid: {
      gap: 12,
      padding: { top: 12, right: 0, bottom: 0, left: 0 },
      background: {
        type: 'solid',
        color: 'transparent',
      },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 0,
      },
      borderRadius: 0,
    },

    cell: {
      minHeight: 100,
      padding: { top: 30, right: 30, bottom: 30, left: 30 },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 12,
      },
      borderRadius: 12,
      background: {
        type: 'solid',
        color: '#f8fafc',
      },
      dayNumber: {
        font: {
          family: primaryFont,
          size: 28,
          weight: 500,
          lineHeight: 1,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#475569',
        position: 'top-left',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      hover: {
        enabled: true,
        background: '#f1f5f9',
        borderColor: '#cbd5e1',
        scale: 1.02,
        shadow: {
          enabled: false,
          x: 0,
          y: 2,
          blur: 4,
          spread: 0,
          color: 'rgba(0, 0, 0, 0.1)',
          inset: false,
        },
        transition: 150,
      },
      empty: {
        background: {
          type: 'solid',
          color: '#f1f5f9',
        },
        opacity: 0.4,
      },
    },

    today: {
      enabled: true,
      background: {
        type: 'solid',
        color: brand.brandLight,
      },
      border: {
        width: 2,
        style: 'solid',
        color: brand.brand,
        radius: 12,
      },
      dayNumberColor: brand.brand,
      dayNumberBackground: 'transparent',
      indicator: {
        show: true,
        type: 'dot',
        color: brand.brand,
        size: 5,
      },
    },

    booked: {
      background: {
        type: 'solid',
        color: brand.brand,
      },
      dayNumberColor: '#ffffff',
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 12,
      },
      text: {
        show: true,
        content: 'BOOKED',
        font: {
          family: primaryFont,
          size: 11,
          weight: 600,
          lineHeight: 1,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        color: 'rgba(255, 255, 255, 0.9)',
        position: 'bottom',
      },
      icon: {
        show: false,
        type: 'icon',
        value: 'check',
        size: 24,
        color: '#ffffff',
        position: 'center',
        opacity: 1,
      },
      pattern: {
        show: false,
        type: 'none',
        color: '#ffffff',
        opacity: 0.1,
        size: 10,
      },
      guestInfo: {
        show: false,
        font: {
          family: primaryFont,
          size: 10,
          weight: 500,
          lineHeight: 1.2,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#ffffff',
        truncate: true,
      },
    },

    available: {
      background: {
        type: 'solid',
        color: '#f8fafc',
      },
      dayNumberColor: '#475569',
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 12,
      },
      price: {
        show: false,
        font: {
          family: primaryFont,
          size: 12,
          weight: 600,
          lineHeight: 1,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#0891b2',
        position: 'bottom',
        format: 'currency',
        currency: 'PHP',
      },
      indicator: {
        show: false,
        type: 'dot',
        value: '',
        color: '#06b6d4',
      },
    },

    blocked: {
      background: {
        type: 'solid',
        color: '#f1f5f9',
      },
      dayNumberColor: '#94a3b8',
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 12,
      },
      text: {
        show: true,
        content: 'N/A',
        font: {
          family: primaryFont,
          size: 10,
          weight: 500,
          lineHeight: 1,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        color: '#94a3b8',
      },
      pattern: {
        show: true,
        type: 'diagonal',
        color: '#cbd5e1',
        opacity: 0.6,
      },
      icon: {
        show: false,
        type: 'icon',
        value: 'x',
        size: 16,
        color: '#94a3b8',
        opacity: 0.5,
      },
    },

    bookingBar: {
      show: false,
      height: 20,
      borderRadius: 4,
      background: {
        type: 'solid',
        color: brand.brand,
      },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 4,
      },
      text: {
        show: true,
        font: {
          family: primaryFont,
          size: 11,
          weight: 500,
          lineHeight: 1,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#ffffff',
        truncate: true,
      },
      statusColors: {
        confirmed: brand.brand,
        checkedIn: brand.brandDark,
        pending: '#f59e0b',
        checkout: '#8b5cf6',
      },
    },

    legend: {
      show: false,
      position: 'bottom',
      background: {
        type: 'solid',
        color: '#f8fafc',
      },
      padding: { top: 14, right: 18, bottom: 14, left: 18 },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 14,
      },
      borderRadius: 14,
      item: {
        gap: 20,
        labelFont: {
          family: primaryFont,
          size: 14,
          weight: 500,
          lineHeight: 1,
          letterSpacing: 0,
          textTransform: 'none',
        },
        labelColor: '#64748b',
        indicatorSize: 14,
        indicatorBorderRadius: 6,
      },
      title: {
        show: false,
        text: 'Legend',
        font: {
          family: primaryFont,
          size: 15,
          weight: 600,
          lineHeight: 1.3,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: '#1e293b',
      },
    },

    watermark: {
      show: false,
      type: 'text',
      text: 'Your brand',
      color: '#94a3b8',
      opacity: 0.3,
      position: 'bottom-right',
      size: 12,
      font: {
        family: primaryFont,
        size: 12,
        weight: 500,
        lineHeight: 1,
        letterSpacing: 0,
        textTransform: 'none',
      },
    },

    canvasFrame: createDefaultCanvasFrame('square'),
  };
}
