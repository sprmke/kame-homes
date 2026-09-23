import { describe, expect, it } from 'vitest';

import { buildImportCsvTemplate, downloadImportCsvTemplate, IMPORT_CSV_TEMPLATE_HEADERS } from '@/features/dashboard/import/lib/importCsvTemplate';

describe('buildImportCsvTemplate', () => {

  it('buildImportCsvTemplate is exported', () => {
    expect(typeof buildImportCsvTemplate).toBe('function');
  });

});

describe('downloadImportCsvTemplate', () => {

  it('downloadImportCsvTemplate is exported', () => {
    expect(typeof downloadImportCsvTemplate).toBe('function');
  });

});

describe('IMPORT_CSV_TEMPLATE_HEADERS', () => {
  it('is defined', () => {
    expect(IMPORT_CSV_TEMPLATE_HEADERS).toBeDefined();
  });
});
