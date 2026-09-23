import { describe, expect, it } from 'vitest';

import { workflowPrimaryActionClass, workflowWarningActionClass, workflowDestructiveActionClass, workflowNeutralActionClass, workflowBackActionClass, workflowActionLabelGroupClass, workflowActionLabelTextClass, workflowActionLabelTextPairedClass, workflowInlineLink } from '@/features/dashboard/bookings/lib/workflowActionButtonStyles';

describe('workflowPrimaryActionClass', () => {

  it('workflowPrimaryActionClass is exported', () => {
    expect(typeof workflowPrimaryActionClass).toBe('function');
  });

});

describe('workflowWarningActionClass', () => {

  it('workflowWarningActionClass is exported', () => {
    expect(typeof workflowWarningActionClass).toBe('function');
  });

});

describe('workflowDestructiveActionClass', () => {

  it('workflowDestructiveActionClass is exported', () => {
    expect(typeof workflowDestructiveActionClass).toBe('function');
  });

});

describe('workflowNeutralActionClass', () => {

  it('workflowNeutralActionClass is exported', () => {
    expect(typeof workflowNeutralActionClass).toBe('function');
  });

});

describe('workflowBackActionClass', () => {
  it('is defined', () => {
    expect(workflowBackActionClass).toBeDefined();
  });
});

describe('workflowActionLabelGroupClass', () => {
  it('is defined', () => {
    expect(workflowActionLabelGroupClass).toBeDefined();
  });
});

describe('workflowActionLabelTextClass', () => {
  it('is defined', () => {
    expect(workflowActionLabelTextClass).toBeDefined();
  });
});

describe('workflowActionLabelTextPairedClass', () => {
  it('is defined', () => {
    expect(workflowActionLabelTextPairedClass).toBeDefined();
  });
});

describe('workflowInlineLink', () => {
  it('is defined', () => {
    expect(workflowInlineLink).toBeDefined();
  });
});
