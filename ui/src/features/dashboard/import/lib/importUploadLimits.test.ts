import { describe, expect, it } from 'vitest';

import { validateImportCsvFile, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROW_COUNT, IMPORT_ACCEPT, IMPORT_LIMITS_HINT } from '@/features/dashboard/import/lib/importUploadLimits';

describe('validateImportCsvFile', () => {

  it('validateImportCsvFile is exported', () => {
    expect(typeof validateImportCsvFile).toBe('function');
  });

});

describe('IMPORT_MAX_FILE_BYTES', () => {
  it('is defined', () => {
    expect(IMPORT_MAX_FILE_BYTES).toBeDefined();
  });
});

describe('IMPORT_MAX_ROW_COUNT', () => {
  it('is defined', () => {
    expect(IMPORT_MAX_ROW_COUNT).toBeDefined();
  });
});

describe('IMPORT_ACCEPT', () => {
  it('is defined', () => {
    expect(IMPORT_ACCEPT).toBeDefined();
  });
});

describe('IMPORT_LIMITS_HINT', () => {
  it('is defined', () => {
    expect(IMPORT_LIMITS_HINT).toBeDefined();
  });
});
