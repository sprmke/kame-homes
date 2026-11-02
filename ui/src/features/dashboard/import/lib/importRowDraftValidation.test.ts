import { describe, expect, it } from 'vitest';

import {
  parseImportDraftDate,
  validateImportFieldDraft,
} from '@/features/dashboard/import/lib/importRowDraftValidation';

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

describe('validateImportFieldDraft — stay dates', () => {
  const base = {
    mappedData: {} as Record<string, string | null>,
    drafts: {} as Record<string, string>,
  };

  it('accepts a same-day stay', () => {
    expect(
      validateImportFieldDraft({
        ...base,
        fieldId: 'check_out_date',
        value: '2026-01-15',
        mappedData: { check_in_date: '2026-01-15' },
        drafts: { check_out_date: '2026-01-15' },
      })
    ).toBeNull();
  });

  it('rejects check-out before check-in', () => {
    expect(
      validateImportFieldDraft({
        ...base,
        fieldId: 'check_out_date',
        value: '2026-01-14',
        mappedData: { check_in_date: '2026-01-15' },
        drafts: { check_out_date: '2026-01-14' },
      })
    ).toBe('Check-out cannot be before check-in.');
  });
});
