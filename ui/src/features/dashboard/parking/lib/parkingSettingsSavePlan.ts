import type {
  ParkingSettingsCompletionResult,
  ParkingSettingsSectionId,
} from '@/features/dashboard/parking/lib/parkingSettingsCompletion';

export type ParkingSettingsDirtyFlags = {
  profile: boolean;
  details: boolean;
  features: boolean;
  location: boolean;
  payment: boolean;
  automation: boolean;
};

export type ParkingSettingsSavePlan = {
  saveProfile: boolean;
  saveDetails: boolean;
  saveFeatures: boolean;
  saveLocation: boolean;
  savePayment: boolean;
  saveAutomation: boolean;
  blockedSectionIds: ParkingSettingsSectionId[];
  firstBlockedSectionId: ParkingSettingsSectionId | null;
  firstBlockedMessage: string | null;
  hasSavableWork: boolean;
};

function sectionDirty(
  sectionId: Exclude<ParkingSettingsSectionId, 'media'>,
  dirty: ParkingSettingsDirtyFlags
): boolean {
  switch (sectionId) {
    case 'basic':
      return dirty.profile;
    case 'details':
      return dirty.details;
    case 'features':
      return dirty.features;
    case 'location':
      return dirty.location;
    case 'payment':
      return dirty.payment;
    default:
      return false;
  }
}

/**
 * Allow saving dirty sections that pass validation without requiring the whole
 * parking listing to be complete (matches property settings behavior).
 */
export function planParkingSettingsSave(input: {
  dirty: ParkingSettingsDirtyFlags;
  completion: ParkingSettingsCompletionResult;
  /** When set, only these sections are considered. Empty array = automation-only. */
  scopeSectionIds?: readonly ParkingSettingsSectionId[] | null;
}): ParkingSettingsSavePlan {
  const { dirty, completion } = input;
  const scoped = input.scopeSectionIds != null;
  const scope = scoped ? new Set(input.scopeSectionIds) : null;
  const issueSet = new Set(completion.issueSectionIds);

  const draftSections: Array<Exclude<ParkingSettingsSectionId, 'media'>> = [
    'basic',
    'details',
    'features',
    'location',
    'payment',
  ];

  const candidates = draftSections.filter((sectionId) => {
    if (scope && !scope.has(sectionId)) return false;
    return sectionDirty(sectionId, dirty);
  });

  const mediaInScopeIncomplete = Boolean(scope?.has('media') && issueSet.has('media'));

  const blockedSectionIds: ParkingSettingsSectionId[] = [];
  const savable = new Set<Exclude<ParkingSettingsSectionId, 'media'>>();

  for (const sectionId of candidates) {
    const blockedByMedia = sectionId === 'features' && mediaInScopeIncomplete;
    if (issueSet.has(sectionId) || blockedByMedia) {
      blockedSectionIds.push(sectionId);
    } else {
      savable.add(sectionId);
    }
  }

  if (mediaInScopeIncomplete) {
    blockedSectionIds.unshift('media');
  }

  // Full page: save automation whenever dirty. Scoped: only when scope is empty (email step).
  const saveAutomation = dirty.automation && (!scoped || (scope?.size ?? 0) === 0);

  const saveProfile = savable.has('basic');
  const saveDetails = savable.has('details');
  const saveFeatures = savable.has('features');
  const saveLocation = savable.has('location');
  const savePayment = savable.has('payment');

  const firstBlockedSectionId = blockedSectionIds[0] ?? null;
  const firstBlockedMessage = firstBlockedSectionId
    ? (completion.sectionMessages[firstBlockedSectionId] ?? completion.firstErrorMessage)
    : null;

  return {
    saveProfile,
    saveDetails,
    saveFeatures,
    saveLocation,
    savePayment,
    saveAutomation,
    blockedSectionIds,
    firstBlockedSectionId,
    firstBlockedMessage,
    hasSavableWork:
      saveProfile || saveDetails || saveFeatures || saveLocation || savePayment || saveAutomation,
  };
}

export const SETUP_GUIDE_PARKING_SAVE_SCOPE: Record<
  'basics' | 'location' | 'photo' | 'payments' | 'email' | 'pricing',
  readonly ParkingSettingsSectionId[]
> = {
  basics: ['basic', 'details'],
  location: ['location'],
  photo: ['media', 'features'],
  payments: ['payment'],
  email: [],
  // Pricing owns its own save flow via `SetupGuideParkingPricingEmbed` — never scope-saved here.
  pricing: [],
};
