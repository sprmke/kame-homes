import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';

/** Swap stock photo backgrounds for the property cover image when loading photo presets. */
export function applyPropertyPhotoToCalendarStyles(
  styles: CalendarStyles,
  propertyPhotoUrl?: string
): CalendarStyles {
  if (!propertyPhotoUrl) return styles;
  if (styles.container.background.type !== 'image') return styles;
  return {
    ...styles,
    container: {
      ...styles.container,
      background: { ...styles.container.background, imageUrl: propertyPhotoUrl },
    },
  };
}
