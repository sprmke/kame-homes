import { describe, expect, it } from 'vitest';

import { deriveSetupGuideProgress } from '@/features/dashboard/setup-guide/lib/setupGuideProgress';
import { assembleSetupGuideSteps } from '@/features/dashboard/setup-guide/lib/setupGuideSteps';
import { EMPTY_SETUP_GUIDE_STATE } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

describe('assembleSetupGuideSteps', () => {
  it('builds org-only steps when there are no listings', () => {
    const steps = assembleSetupGuideSteps({
      hostModes: ['property'],
      properties: [],
      parkings: [],
    });
    expect(steps.map((s) => s.id)).toEqual([
      'welcome',
      'org.brand',
      'org.verification',
      'org.recommended',
      'org.team',
      'org.done',
    ]);
  });

  it('includes a property block and a parking block for both-listing hosts', () => {
    const steps = assembleSetupGuideSteps({
      hostModes: ['property', 'parking'],
      properties: [{ id: 'prop-1', name: 'Solea 2005' }],
      parkings: [{ id: 'park-1', name: 'Bali P2-26' }],
    });

    expect(steps.filter((s) => s.propertyId === 'prop-1').map((s) => s.id)).toEqual([
      'property.prop-1.basics',
      'property.prop-1.location',
      'property.prop-1.content',
      'property.prop-1.pricing',
      'property.prop-1.payments',
      'property.prop-1.guestform',
      'property.prop-1.email',
    ]);
    expect(steps.filter((s) => s.parkingId === 'park-1').map((s) => s.id)).toEqual([
      'parking.park-1.basics',
      'parking.park-1.location',
      'parking.park-1.photo',
      'parking.park-1.pricing',
      'parking.park-1.payments',
      'parking.park-1.email',
    ]);

    const brand = steps.findIndex((s) => s.id === 'org.brand');
    const verification = steps.findIndex((s) => s.id === 'org.verification');
    const recommended = steps.findIndex((s) => s.id === 'org.recommended');
    const propBasics = steps.findIndex((s) => s.id === 'property.prop-1.basics');
    const parkBasics = steps.findIndex((s) => s.id === 'parking.park-1.basics');
    const team = steps.findIndex((s) => s.id === 'org.team');
    expect(propBasics).toBeGreaterThan(brand);
    expect(parkBasics).toBeGreaterThan(propBasics);
    expect(verification).toBeGreaterThan(parkBasics);
    expect(recommended).toBeGreaterThan(verification);
    expect(team).toBeGreaterThan(recommended);
  });

  it('repeats property blocks for two properties', () => {
    const steps = assembleSetupGuideSteps({
      hostModes: ['property'],
      properties: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      parkings: [],
    });
    expect(steps.filter((s) => s.kind === 'property.basics').map((s) => s.propertyId)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('deriveSetupGuideProgress', () => {
  const bothListingSteps = assembleSetupGuideSteps({
    hostModes: ['property', 'parking'],
    properties: [{ id: 'prop-1', name: 'Solea 2005' }],
    parkings: [{ id: 'park-1', name: 'Bali P2-26' }],
  });

  it('sums requiredRemaining across org + every listing block', () => {
    const progress = deriveSetupGuideProgress({
      steps: bothListingSteps,
      completion: {
        orgIssueSectionIds: ['basic', 'branding'],
        propertyIssueSectionIdsById: {
          'prop-1': [
            'basic',
            'details',
            'location',
            'media',
            'amenities',
            'house-rules',
            'cancellation',
            'payment',
            'guest-form',
            'building-forms',
            'email-automations',
          ],
        },
        parkingIssueSectionIdsById: {
          'park-1': ['basic', 'details', 'location', 'media', 'features', 'payment'],
        },
        hostTier1Submitted: false,
        listingIdsMissingTier1Proof: ['prop-1', 'park-1'],
        recommendedSubmitted: false,
      },
      persisted: { skippedSteps: [], reviewedSteps: [], lastStepId: null },
    });

    expect(progress.requiredRemaining).toBe(progress.requiredTotal);
    expect(progress.requiredTotal).toBeGreaterThan(10);
    const requiredKinds = progress.steps
      .filter((s) => s.step.requirement === 'required')
      .map((s) => s.step.kind);
    expect(requiredKinds).toContain('property.pricing');
    expect(requiredKinds).toContain('parking.pricing');
    expect(requiredKinds).toContain('parking.email');
    expect(requiredKinds).not.toContain('org.verification');
    expect(requiredKinds).not.toContain('org.team');
    expect(requiredKinds).not.toContain('org.recommended');
    expect(progress.steps.find((s) => s.step.kind === 'org.done')?.status).toBe('incomplete');
  });

  it('completing only the property block does not clear the launcher', () => {
    const progress = deriveSetupGuideProgress({
      steps: bothListingSteps,
      completion: {
        orgIssueSectionIds: [],
        propertyIssueSectionIdsById: { 'prop-1': [] },
        parkingIssueSectionIdsById: {
          'park-1': ['basic', 'location', 'media', 'payment'],
        },
        hostTier1Submitted: true,
        listingIdsMissingTier1Proof: ['park-1'],
        recommendedSubmitted: false,
      },
      persisted: {
        skippedSteps: [],
        reviewedSteps: [
          'property.prop-1.pricing',
          'parking.park-1.pricing',
          'parking.park-1.email',
          'org.team',
        ],
        lastStepId: 'parking.park-1.basics',
      },
    });

    expect(progress.requiredRemaining).toBeGreaterThan(0);
    expect(
      progress.steps.filter(
        (s) =>
          s.step.parkingId === 'park-1' &&
          s.status !== 'complete' &&
          s.step.requirement === 'required'
      ).length
    ).toBeGreaterThan(0);
  });

  it('requires pricing and parking email review before requiredRemaining clears', () => {
    const progress = deriveSetupGuideProgress({
      steps: bothListingSteps,
      completion: {
        orgIssueSectionIds: [],
        propertyIssueSectionIdsById: { 'prop-1': [] },
        parkingIssueSectionIdsById: { 'park-1': [] },
        hostTier1Submitted: true,
        listingIdsMissingTier1Proof: [],
        recommendedSubmitted: false,
      },
      persisted: { skippedSteps: [], reviewedSteps: [], lastStepId: 'org.brand' },
    });

    expect(progress.requiredRemaining).toBeGreaterThan(0);
    expect(progress.steps.find((s) => s.step.id === 'property.prop-1.pricing')?.status).toBe(
      'incomplete'
    );
    expect(progress.steps.find((s) => s.step.id === 'org.recommended')?.status).toBe('incomplete');
    expect(progress.steps.find((s) => s.step.kind === 'org.done')?.status).toBe('incomplete');
  });

  it('clears requiredRemaining when required steps are complete, ignoring optional gaps', () => {
    const progress = deriveSetupGuideProgress({
      steps: bothListingSteps,
      completion: {
        orgIssueSectionIds: [],
        propertyIssueSectionIdsById: { 'prop-1': [] },
        parkingIssueSectionIdsById: { 'park-1': [] },
        hostTier1Submitted: false,
        listingIdsMissingTier1Proof: ['prop-1', 'park-1'],
        recommendedSubmitted: false,
      },
      persisted: {
        skippedSteps: [],
        reviewedSteps: [
          'property.prop-1.pricing',
          'parking.park-1.pricing',
          'parking.park-1.email',
        ],
        lastStepId: 'org.team',
      },
    });

    expect(progress.requiredRemaining).toBe(0);
    expect(progress.steps.find((s) => s.step.kind === 'org.done')?.status).toBe('complete');
    expect(progress.steps.find((s) => s.step.id === 'org.verification')?.status).toBe('incomplete');
    expect(progress.steps.find((s) => s.step.id === 'org.recommended')?.status).toBe('incomplete');
  });

  it('marks pricing complete only via reviewedSteps', () => {
    const progress = deriveSetupGuideProgress({
      steps: bothListingSteps,
      completion: {
        orgIssueSectionIds: [],
        propertyIssueSectionIdsById: { 'prop-1': [] },
        parkingIssueSectionIdsById: { 'park-1': [] },
        hostTier1Submitted: true,
        listingIdsMissingTier1Proof: [],
        recommendedSubmitted: false,
      },
      persisted: {
        skippedSteps: [],
        reviewedSteps: ['property.prop-1.pricing'],
        lastStepId: 'property.prop-1.pricing',
      },
    });
    expect(progress.steps.find((s) => s.step.id === 'property.prop-1.pricing')?.status).toBe(
      'complete'
    );
  });

  it('uses empty persisted state defaults safely', () => {
    const progress = deriveSetupGuideProgress({
      steps: assembleSetupGuideSteps({
        hostModes: ['property'],
        properties: [{ id: 'p1', name: 'P' }],
        parkings: [],
      }),
      completion: {
        orgIssueSectionIds: [],
        propertyIssueSectionIdsById: { p1: [] },
        parkingIssueSectionIdsById: {},
        hostTier1Submitted: true,
        listingIdsMissingTier1Proof: [],
        recommendedSubmitted: true,
      },
      persisted: {
        skippedSteps: EMPTY_SETUP_GUIDE_STATE.skippedSteps,
        reviewedSteps: [...EMPTY_SETUP_GUIDE_STATE.reviewedSteps, 'property.p1.pricing'],
        lastStepId: 'property.p1.email',
      },
    });
    expect(progress.resumeStepId).toBeTruthy();
  });
});
