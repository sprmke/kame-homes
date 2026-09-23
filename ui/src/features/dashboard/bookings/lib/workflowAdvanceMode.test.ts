import { describe, expect, it } from 'vitest';

import { workflowAdvanceLegend, formatSdRefundLeadPhrase, pipelineAdvanceMode, nestedAdvanceMode, pipelineAdvanceGuide, cancelledAdvanceGuide, nestedAdvanceGuide, workflowAdvanceModeAria, pipelineAdvanceDisplay, nestedAdvanceDisplay, WORKFLOW_ADVANCE_LEGEND, WORKFLOW_PLAN_PREVIEW_SUMMARY } from '@/features/dashboard/bookings/lib/workflowAdvanceMode';

describe('workflowAdvanceLegend', () => {

  it('workflowAdvanceLegend is exported', () => {
    expect(typeof workflowAdvanceLegend).toBe('function');
  });

});

describe('formatSdRefundLeadPhrase', () => {

  it('formatSdRefundLeadPhrase is exported', () => {
    expect(typeof formatSdRefundLeadPhrase).toBe('function');
  });

});

describe('pipelineAdvanceMode', () => {

  it('pipelineAdvanceMode is exported', () => {
    expect(typeof pipelineAdvanceMode).toBe('function');
  });

});

describe('nestedAdvanceMode', () => {

  it('nestedAdvanceMode is exported', () => {
    expect(typeof nestedAdvanceMode).toBe('function');
  });

});

describe('pipelineAdvanceGuide', () => {

  it('pipelineAdvanceGuide is exported', () => {
    expect(typeof pipelineAdvanceGuide).toBe('function');
  });

});

describe('cancelledAdvanceGuide', () => {

  it('cancelledAdvanceGuide is exported', () => {
    expect(typeof cancelledAdvanceGuide).toBe('function');
  });

});

describe('nestedAdvanceGuide', () => {

  it('nestedAdvanceGuide is exported', () => {
    expect(typeof nestedAdvanceGuide).toBe('function');
  });

});

describe('workflowAdvanceModeAria', () => {

  it('workflowAdvanceModeAria is exported', () => {
    expect(typeof workflowAdvanceModeAria).toBe('function');
  });

});

describe('pipelineAdvanceDisplay', () => {

  it('pipelineAdvanceDisplay is exported', () => {
    expect(typeof pipelineAdvanceDisplay).toBe('function');
  });

});

describe('nestedAdvanceDisplay', () => {

  it('nestedAdvanceDisplay is exported', () => {
    expect(typeof nestedAdvanceDisplay).toBe('function');
  });

});

describe('WORKFLOW_ADVANCE_LEGEND', () => {
  it('is defined', () => {
    expect(WORKFLOW_ADVANCE_LEGEND).toBeDefined();
  });
});

describe('WORKFLOW_PLAN_PREVIEW_SUMMARY', () => {
  it('is defined', () => {
    expect(WORKFLOW_PLAN_PREVIEW_SUMMARY).toBeDefined();
  });
});
