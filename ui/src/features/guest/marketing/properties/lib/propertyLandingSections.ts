import type {
  PropertyLandingSectionConfig,
  PropertyLandingSectionId,
} from '@/features/guest/marketing/properties/types/publicProperty';

/** Canonical listing section order — not host-reorderable. */
export const PROPERTY_LANDING_SECTION_ORDER: readonly PropertyLandingSectionId[] = [
  'gallery',
  'overview',
  'amenities',
  'location',
  'rules',
  'reviews',
] as const;

/** Always shown — omitted from the Page Editor Sections list. */
export const PROPERTY_LANDING_MANDATORY_SECTIONS: ReadonlySet<PropertyLandingSectionId> = new Set([
  'gallery',
  'overview',
]);

/** Host can toggle visibility only (order is fixed). */
export const PROPERTY_LANDING_OPTIONAL_SECTIONS: readonly PropertyLandingSectionId[] =
  PROPERTY_LANDING_SECTION_ORDER.filter((id) => !PROPERTY_LANDING_MANDATORY_SECTIONS.has(id));

export function defaultPropertyLandingSectionConfig(): PropertyLandingSectionConfig {
  return {
    version: 1,
    sections: PROPERTY_LANDING_SECTION_ORDER.map((id, order) => ({
      id,
      visible: true,
      order,
    })),
  };
}

/**
 * Visible sections in the fixed product order.
 * Gallery + overview are always included; other sections honor `visible`.
 */
export function resolvePropertyLandingSections(
  sectionConfig?: PropertyLandingSectionConfig | null
): PropertyLandingSectionId[] {
  const config = sectionConfig ?? defaultPropertyLandingSectionConfig();
  const visibility = new Map(config.sections.map((section) => [section.id, section.visible]));

  return PROPERTY_LANDING_SECTION_ORDER.filter((id) => {
    if (PROPERTY_LANDING_MANDATORY_SECTIONS.has(id)) return true;
    return visibility.get(id) !== false;
  });
}
