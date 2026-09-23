import { describe, expect, it } from 'vitest';

import { requirementApplies, parseDocumentRequirements, mergeDocumentRequirements, requirementMatchesPdfTemplate, hasApplicableDocumentPdfTemplate, requirementDocKind, requirementNeedsApprovedPdf } from '@/features/dashboard/bookings/lib/documentRequirements';

describe('requirementApplies', () => {

  it('requirementApplies is exported', () => {
    expect(typeof requirementApplies).toBe('function');
  });

});

describe('parseDocumentRequirements', () => {

  it('parseDocumentRequirements is exported', () => {
    expect(typeof parseDocumentRequirements).toBe('function');
  });

});

describe('mergeDocumentRequirements', () => {

  it('mergeDocumentRequirements is exported', () => {
    expect(typeof mergeDocumentRequirements).toBe('function');
  });

});

describe('requirementMatchesPdfTemplate', () => {

  it('requirementMatchesPdfTemplate is exported', () => {
    expect(typeof requirementMatchesPdfTemplate).toBe('function');
  });

});

describe('hasApplicableDocumentPdfTemplate', () => {

  it('hasApplicableDocumentPdfTemplate is exported', () => {
    expect(typeof hasApplicableDocumentPdfTemplate).toBe('function');
  });

});

describe('requirementDocKind', () => {

  it('requirementDocKind is exported', () => {
    expect(typeof requirementDocKind).toBe('function');
  });

});

describe('requirementNeedsApprovedPdf', () => {

  it('requirementNeedsApprovedPdf is exported', () => {
    expect(typeof requirementNeedsApprovedPdf).toBe('function');
  });

});
