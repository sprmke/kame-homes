import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import { normalizeCalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  calendarBrandPalette,
  type CalendarBrandPalette,
} from '@/features/dashboard/marketing/lib/calendarBrandTints';
import {
  canvasFrameBackgroundForFormat,
  normalizeCalendarCanvasFrame,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

export type { CalendarBrandPalette };
export {
  calendarBrandDarkShade,
  calendarBrandLightTint,
  calendarBrandPalette,
} from '@/features/dashboard/marketing/lib/calendarBrandTints';

export type ApplyBrandAccentOptions = {
  /** Keep preset-authored today, booked, and header colors (designer templates). */
  preservePresetPalette?: boolean;
};

/** Map org/property brand onto calendar accent states (booked, today, bars, canvas). */
export function applyBrandAccentToCalendarStyles(
  styles: CalendarStyles,
  brandColor?: string,
  options?: ApplyBrandAccentOptions
): CalendarStyles {
  const palette = calendarBrandPalette(brandColor);
  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame, palette.brand);

  if (options?.preservePresetPalette) {
    return normalizeCalendarStyles({
      ...styles,
      canvasFrame: {
        ...frame,
        background:
          frame.format === 'square'
            ? frame.background
            : canvasFrameBackgroundForFormat(frame.format, palette.brand),
      },
    });
  }

  return normalizeCalendarStyles({
    ...styles,
    header: {
      ...styles.header,
      propertyName: {
        ...styles.header.propertyName,
        color: palette.brand,
      },
    },
    today: {
      ...styles.today,
      background: { type: 'solid', color: palette.brandLight },
      border: { ...styles.today.border, color: palette.brand },
      dayNumberColor: palette.brand,
      indicator: { ...styles.today.indicator, color: palette.brand },
    },
    booked: {
      ...styles.booked,
      background: { type: 'solid', color: palette.brand },
    },
    bookingBar: {
      ...styles.bookingBar,
      background: { type: 'solid', color: palette.brand },
      statusColors: {
        ...styles.bookingBar.statusColors,
        confirmed: palette.brand,
        checkedIn: palette.brandDark,
      },
    },
    canvasFrame: {
      ...frame,
      background:
        frame.format === 'square'
          ? frame.background
          : canvasFrameBackgroundForFormat(frame.format, palette.brand),
    },
  });
}
