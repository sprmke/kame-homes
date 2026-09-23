import { describe, expect, it } from 'vitest';

import { bookingWasRegressedInPipeline, shouldOfferWorkflowEmailChoices, defaultWorkflowEmailChoiceState, buildWorkflowEmailDevControls } from '@/features/dashboard/bookings/lib/workflowTransitionEmailControls';

describe('bookingWasRegressedInPipeline', () => {

  it('bookingWasRegressedInPipeline is exported', () => {
    expect(typeof bookingWasRegressedInPipeline).toBe('function');
  });

});

describe('shouldOfferWorkflowEmailChoices', () => {

  it('shouldOfferWorkflowEmailChoices is exported', () => {
    expect(typeof shouldOfferWorkflowEmailChoices).toBe('function');
  });

});

describe('defaultWorkflowEmailChoiceState', () => {

  it('defaultWorkflowEmailChoiceState is exported', () => {
    expect(typeof defaultWorkflowEmailChoiceState).toBe('function');
  });

});

describe('buildWorkflowEmailDevControls', () => {

  it('buildWorkflowEmailDevControls is exported', () => {
    expect(typeof buildWorkflowEmailDevControls).toBe('function');
  });

});
