import type { ParkingSettingsSectionId } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';

/** Sections that use a top-of-card banner instead of per-field inputs. */
export const PARKING_SETTINGS_BANNER_SECTIONS: ParkingSettingsSectionId[] = ['media', 'features'];

export function resolveParkingSettingsFieldError(
  fieldId: string,
  fieldErrors: Record<string, string>,
  interactedFields: Readonly<Record<string, boolean>>,
  showAllErrors: boolean
): string | null {
  const error = fieldErrors[fieldId];
  if (!error) return null;
  if (showAllErrors || interactedFields[fieldId]) return error;
  return null;
}

export function parkingSettingsSectionBanner(
  sectionId: ParkingSettingsSectionId,
  sectionMessages: Partial<Record<ParkingSettingsSectionId, string>>
): string | undefined {
  if (!PARKING_SETTINGS_BANNER_SECTIONS.includes(sectionId)) return undefined;
  return sectionMessages[sectionId];
}
