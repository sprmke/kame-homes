import { describe, expect, it } from 'vitest';

import { stageForViewedStep, buildWorkflowStageDeck, stageDeckStepState, shortDocStepLabel, pendingDocumentsProceedBlockedHint } from '@/features/dashboard/bookings/lib/workflowStageDeck';

describe('stageForViewedStep', () => {

  it('stageForViewedStep is exported', () => {
    expect(typeof stageForViewedStep).toBe('function');
  });

});

describe('buildWorkflowStageDeck', () => {

  it('buildWorkflowStageDeck is exported', () => {
    expect(typeof buildWorkflowStageDeck).toBe('function');
  });

});

describe('stageDeckStepState', () => {

  it('stageDeckStepState is exported', () => {
    expect(typeof stageDeckStepState).toBe('function');
  });

});

describe('shortDocStepLabel', () => {

  it('shortDocStepLabel is exported', () => {
    expect(typeof shortDocStepLabel).toBe('function');
  });

});

describe('pendingDocumentsProceedBlockedHint', () => {

  it('pendingDocumentsProceedBlockedHint is exported', () => {
    expect(typeof pendingDocumentsProceedBlockedHint).toBe('function');
  });

});
