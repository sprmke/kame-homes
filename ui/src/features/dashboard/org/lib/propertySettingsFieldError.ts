import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';

/** Sections that use a top-of-card banner instead of per-field inputs. */
export const PROPERTY_SETTINGS_BANNER_SECTIONS: PropertySettingsSectionId[] = [
  'media',
  'amenities',
  'integrations',
];

export function resolvePropertySettingsFieldError(
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

export function propertySettingsSectionBanner(
  sectionId: PropertySettingsSectionId,
  sectionMessages: Partial<Record<PropertySettingsSectionId, string>>
): string | undefined {
  if (!PROPERTY_SETTINGS_BANNER_SECTIONS.includes(sectionId)) return undefined;
  return sectionMessages[sectionId];
}
