import { describe, expect, it } from 'vitest';

import { isRequestPdfTemplateId, documentRequirementsOverrideEqual, documentRequirementLabelFieldErrors, createDocumentRequirement, addDocumentRequirement, removeDocumentRequirement, moveDocumentRequirement, updateDocumentRequirement, DOCUMENT_PDF_TEMPLATE_NONE } from '@/features/dashboard/org/lib/propertyDocumentRequirements';

describe('isRequestPdfTemplateId', () => {

  it('isRequestPdfTemplateId is exported', () => {
    expect(typeof isRequestPdfTemplateId).toBe('function');
  });

});

describe('documentRequirementsOverrideEqual', () => {

  it('documentRequirementsOverrideEqual is exported', () => {
    expect(typeof documentRequirementsOverrideEqual).toBe('function');
  });

});

describe('documentRequirementLabelFieldErrors', () => {

  it('documentRequirementLabelFieldErrors is exported', () => {
    expect(typeof documentRequirementLabelFieldErrors).toBe('function');
  });

});

describe('createDocumentRequirement', () => {

  it('createDocumentRequirement is exported', () => {
    expect(typeof createDocumentRequirement).toBe('function');
  });

});

describe('addDocumentRequirement', () => {

  it('addDocumentRequirement is exported', () => {
    expect(typeof addDocumentRequirement).toBe('function');
  });

});

describe('removeDocumentRequirement', () => {

  it('removeDocumentRequirement is exported', () => {
    expect(typeof removeDocumentRequirement).toBe('function');
  });

});

describe('moveDocumentRequirement', () => {

  it('moveDocumentRequirement is exported', () => {
    expect(typeof moveDocumentRequirement).toBe('function');
  });

});

describe('updateDocumentRequirement', () => {

  it('updateDocumentRequirement is exported', () => {
    expect(typeof updateDocumentRequirement).toBe('function');
  });

});

describe('DOCUMENT_PDF_TEMPLATE_NONE', () => {
  it('is defined', () => {
    expect(DOCUMENT_PDF_TEMPLATE_NONE).toBeDefined();
  });
});
