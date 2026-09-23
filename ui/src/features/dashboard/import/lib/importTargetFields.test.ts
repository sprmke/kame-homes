import { describe, expect, it } from 'vitest';

import { labelForImportTarget, formatImportValidationMessage, formatImportRowIssueSummary, REQUIRED_TARGET_FIELDS, OPTIONAL_TARGET_FIELDS } from '@/features/dashboard/import/lib/importTargetFields';

describe('labelForImportTarget', () => {

  it('labelForImportTarget is exported', () => {
    expect(typeof labelForImportTarget).toBe('function');
  });

});

describe('formatImportValidationMessage', () => {

  it('formatImportValidationMessage is exported', () => {
    expect(typeof formatImportValidationMessage).toBe('function');
  });

});

describe('formatImportRowIssueSummary', () => {

  it('formatImportRowIssueSummary is exported', () => {
    expect(typeof formatImportRowIssueSummary).toBe('function');
  });

});

describe('REQUIRED_TARGET_FIELDS', () => {
  it('is defined', () => {
    expect(REQUIRED_TARGET_FIELDS).toBeDefined();
  });
});

describe('OPTIONAL_TARGET_FIELDS', () => {
  it('is defined', () => {
    expect(OPTIONAL_TARGET_FIELDS).toBeDefined();
  });
});
