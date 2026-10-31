import type { OrgSettingsSectionId } from '@/features/dashboard/org/lib/orgSettingsCompletion';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import type { ParkingSettingsSectionId } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';

export type SetupGuideHostMode = 'property' | 'parking';

export type SetupGuideListingRef = {
  id: string;
  name: string;
};

export type SetupGuideStepKind =
  | 'welcome'
  | 'org.brand'
  | 'property.basics'
  | 'property.location'
  | 'property.content'
  | 'property.pricing'
  | 'property.payments'
  | 'property.guestform'
  | 'property.email'
  | 'parking.basics'
  | 'parking.location'
  | 'parking.photo'
  | 'parking.pricing'
  | 'parking.payments'
  | 'parking.email'
  | 'org.verification'
  | 'org.team'
  | 'org.recommended'
  | 'org.done';

export type SetupGuideStepRequirement = 'required' | 'recommended' | 'optional' | 'none';

export type SetupGuideStepGroup =
  | { type: 'org-start' }
  /** Host Tier 1 + Recommended — after listing blocks, before finish. */
  | { type: 'org-trust' }
  | { type: 'property'; propertyId: string; propertyName: string }
  | { type: 'parking'; parkingId: string; parkingName: string }
  | { type: 'org-finish' };

export type SetupGuideCompletionSection =
  | { scope: 'org'; sectionId: OrgSettingsSectionId }
  | { scope: 'property'; propertyId: string; sectionId: PropertySettingsSectionId }
  | { scope: 'parking'; parkingId: string; sectionId: ParkingSettingsSectionId };

export type SetupGuideStep = {
  id: string;
  kind: SetupGuideStepKind;
  title: string;
  requirement: SetupGuideStepRequirement;
  group: SetupGuideStepGroup;
  /** Minutes hint for the rail (cosmetic). */
  estimatedMinutes: number;
  /** Completion sections that must be clear for this step to count complete. */
  completionSections: SetupGuideCompletionSection[];
  propertyId?: string;
  parkingId?: string;
};

export type SetupGuideStepStatus = 'complete' | 'incomplete' | 'skipped' | 'not-applicable';

export type SetupGuideStepProgress = {
  step: SetupGuideStep;
  status: SetupGuideStepStatus;
};

export type SetupGuideProgressResult = {
  steps: SetupGuideStepProgress[];
  requiredRemaining: number;
  requiredTotal: number;
  requiredComplete: number;
  /** First incomplete required step, else first incomplete any, else last step. */
  resumeStepId: string | null;
};

export type SetupGuidePersistedState = {
  version: 1;
  dismissedAt: string | null;
  completedAt: string | null;
  lastStepId: string | null;
  skippedSteps: string[];
  reviewedSteps: string[];
};

export const SETUP_GUIDE_STATE_VERSION = 1 as const;

export const EMPTY_SETUP_GUIDE_STATE: SetupGuidePersistedState = {
  version: SETUP_GUIDE_STATE_VERSION,
  dismissedAt: null,
  completedAt: null,
  lastStepId: null,
  skippedSteps: [],
  reviewedSteps: [],
};
