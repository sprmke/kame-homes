import { describe, expect, it } from 'vitest';

import { parseImportDraftDate, validateImportFieldDraft } from '@/features/dashboard/import/lib/importRowDraftValidation';

describe('parseImportDraftDate', () => {

  it('parseImportDraftDate is exported', () => {
    expect(typeof parseImportDraftDate).toBe('function');
  });

});

describe('validateImportFieldDraft', () => {

  it('validateImportFieldDraft is exported', () => {
    expect(typeof validateImportFieldDraft).toBe('function');
  });

});
