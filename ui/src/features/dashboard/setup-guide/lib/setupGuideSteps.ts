import type {
  SetupGuideHostMode,
  SetupGuideListingRef,
  SetupGuideStep,
  SetupGuideStepGroup,
  SetupGuideStepKind,
  SetupGuideStepRequirement,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

export type AssembleSetupGuideStepsInput = {
  hostModes: SetupGuideHostMode[];
  properties: SetupGuideListingRef[];
  parkings: SetupGuideListingRef[];
};

function step(
  partial: Omit<SetupGuideStep, 'group'> & { group: SetupGuideStepGroup }
): SetupGuideStep {
  return partial;
}

function propertySteps(property: SetupGuideListingRef): SetupGuideStep[] {
  const group: SetupGuideStepGroup = {
    type: 'property',
    propertyId: property.id,
    propertyName: property.name,
  };
  const id = (suffix: string) => `property.${property.id}.${suffix}`;
  const base = {
    group,
    propertyId: property.id,
  };

  return [
    step({
      ...base,
      id: id('basics'),
      kind: 'property.basics',
      title: 'Property basics',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [
        { scope: 'property', propertyId: property.id, sectionId: 'basic' },
        { scope: 'property', propertyId: property.id, sectionId: 'details' },
      ],
    }),
    step({
      ...base,
      id: id('location'),
      kind: 'property.location',
      title: 'Location',
      requirement: 'required',
      estimatedMinutes: 2,
      completionSections: [{ scope: 'property', propertyId: property.id, sectionId: 'location' }],
    }),
    step({
      ...base,
      id: id('content'),
      kind: 'property.content',
      title: 'Photos & listing content',
      requirement: 'required',
      estimatedMinutes: 8,
      completionSections: [
        { scope: 'property', propertyId: property.id, sectionId: 'media' },
        { scope: 'property', propertyId: property.id, sectionId: 'amenities' },
        { scope: 'property', propertyId: property.id, sectionId: 'house-rules' },
        { scope: 'property', propertyId: property.id, sectionId: 'cancellation' },
      ],
    }),
    step({
      ...base,
      id: id('pricing'),
      kind: 'property.pricing',
      title: 'Pricing & fees',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [],
    }),
    step({
      ...base,
      id: id('payments'),
      kind: 'property.payments',
      title: 'Payments',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [{ scope: 'property', propertyId: property.id, sectionId: 'payment' }],
    }),
    step({
      ...base,
      id: id('guestform'),
      kind: 'property.guestform',
      title: 'Guest form & building forms',
      requirement: 'required',
      estimatedMinutes: 4,
      completionSections: [
        { scope: 'property', propertyId: property.id, sectionId: 'guest-form' },
        { scope: 'property', propertyId: property.id, sectionId: 'building-forms' },
      ],
    }),
    step({
      ...base,
      id: id('email'),
      kind: 'property.email',
      title: 'Email & notifications',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [
        { scope: 'property', propertyId: property.id, sectionId: 'email-automations' },
      ],
    }),
  ];
}

function parkingSteps(parking: SetupGuideListingRef): SetupGuideStep[] {
  const group: SetupGuideStepGroup = {
    type: 'parking',
    parkingId: parking.id,
    parkingName: parking.name,
  };
  const id = (suffix: string) => `parking.${parking.id}.${suffix}`;
  const base = {
    group,
    parkingId: parking.id,
  };

  return [
    step({
      ...base,
      id: id('basics'),
      kind: 'parking.basics',
      title: 'Parking basics',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [
        { scope: 'parking', parkingId: parking.id, sectionId: 'basic' },
        { scope: 'parking', parkingId: parking.id, sectionId: 'details' },
      ],
    }),
    step({
      ...base,
      id: id('location'),
      kind: 'parking.location',
      title: 'Location',
      requirement: 'required',
      estimatedMinutes: 2,
      completionSections: [{ scope: 'parking', parkingId: parking.id, sectionId: 'location' }],
    }),
    step({
      ...base,
      id: id('photo'),
      kind: 'parking.photo',
      title: 'Cover photo & amenities',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [
        { scope: 'parking', parkingId: parking.id, sectionId: 'media' },
        { scope: 'parking', parkingId: parking.id, sectionId: 'features' },
      ],
    }),
    step({
      ...base,
      id: id('pricing'),
      kind: 'parking.pricing',
      title: 'Pricing',
      requirement: 'required',
      estimatedMinutes: 2,
      completionSections: [],
    }),
    step({
      ...base,
      id: id('payments'),
      kind: 'parking.payments',
      title: 'Payments',
      requirement: 'required',
      estimatedMinutes: 3,
      completionSections: [{ scope: 'parking', parkingId: parking.id, sectionId: 'payment' }],
    }),
    step({
      ...base,
      id: id('email'),
      kind: 'parking.email',
      title: 'Email & automation',
      requirement: 'required',
      estimatedMinutes: 2,
      completionSections: [],
    }),
  ];
}

/**
 * Assembles the ordered Setup Guide step list from host modes + listings.
 * Pure — no I/O. Listing blocks are omitted when the host has no listings of that kind
 * (even if hostModes includes the mode); modes only affect empty-state expectations.
 */
export function assembleSetupGuideSteps(input: AssembleSetupGuideStepsInput): SetupGuideStep[] {
  const properties = input.properties.filter((p) => p.id.trim().length > 0);
  const parkings = input.parkings.filter((p) => p.id.trim().length > 0);

  const orgStart: SetupGuideStepGroup = { type: 'org-start' };
  const orgTrust: SetupGuideStepGroup = { type: 'org-trust' };
  const orgFinish: SetupGuideStepGroup = { type: 'org-finish' };

  const steps: SetupGuideStep[] = [
    step({
      id: 'welcome',
      kind: 'welcome',
      title: 'Welcome',
      requirement: 'none',
      group: orgStart,
      estimatedMinutes: 1,
      completionSections: [],
    }),
    step({
      id: 'org.brand',
      kind: 'org.brand',
      title: 'Your brand',
      requirement: 'required',
      group: orgStart,
      estimatedMinutes: 3,
      completionSections: [
        { scope: 'org', sectionId: 'basic' },
        { scope: 'org', sectionId: 'branding' },
      ],
    }),
  ];

  for (const property of properties) {
    steps.push(...propertySteps(property));
  }
  for (const parking of parkings) {
    steps.push(...parkingSteps(parking));
  }

  steps.push(
    step({
      id: 'org.verification',
      kind: 'org.verification',
      title: 'Verification & go-live',
      requirement: 'optional',
      group: orgTrust,
      estimatedMinutes: 5,
      // Completion is custom (host Tier 1 + per-listing proof) — see deriveSetupGuideProgress.
      completionSections: [],
    }),
    step({
      id: 'org.recommended',
      kind: 'org.recommended',
      title: 'Get Recommended',
      requirement: 'optional',
      group: orgTrust,
      estimatedMinutes: 5,
      completionSections: [],
    }),
    step({
      id: 'org.team',
      kind: 'org.team',
      title: 'Invite your team',
      requirement: 'optional',
      group: orgFinish,
      estimatedMinutes: 2,
      completionSections: [],
    }),
    step({
      id: 'org.done',
      kind: 'org.done',
      title: "You're all set",
      requirement: 'none',
      group: orgFinish,
      estimatedMinutes: 1,
      completionSections: [],
    })
  );

  return steps;
}

export function setupGuideStepKindLabel(kind: SetupGuideStepKind): string {
  const labels: Record<SetupGuideStepKind, string> = {
    welcome: 'Welcome',
    'org.brand': 'Your brand',
    'property.basics': 'Property basics',
    'property.location': 'Location',
    'property.content': 'Photos & listing content',
    'property.pricing': 'Pricing & fees',
    'property.payments': 'Payments',
    'property.guestform': 'Guest form & building forms',
    'property.email': 'Email & notifications',
    'parking.basics': 'Parking basics',
    'parking.location': 'Location',
    'parking.photo': 'Cover photo & amenities',
    'parking.pricing': 'Pricing',
    'parking.payments': 'Payments',
    'parking.email': 'Email & automation',
    'org.verification': 'Verification & go-live',
    'org.team': 'Invite your team',
    'org.recommended': 'Get Recommended',
    'org.done': "You're all set",
  };
  return labels[kind];
}

export function isSetupGuideRequiredStep(requirement: SetupGuideStepRequirement): boolean {
  return requirement === 'required';
}

/** Compact label for the in-pane listing stepper. */
export function setupGuideStepShortTitle(kind: SetupGuideStepKind): string {
  const labels: Partial<Record<SetupGuideStepKind, string>> = {
    'property.basics': 'Basics',
    'property.location': 'Location',
    'property.content': 'Photos',
    'property.pricing': 'Pricing',
    'property.payments': 'Payments',
    'property.guestform': 'Guest form',
    'property.email': 'Email',
    'parking.basics': 'Basics',
    'parking.location': 'Location',
    'parking.photo': 'Photo',
    'parking.pricing': 'Pricing',
    'parking.payments': 'Payments',
    'parking.email': 'Email',
  };
  return labels[kind] ?? setupGuideStepKindLabel(kind);
}
