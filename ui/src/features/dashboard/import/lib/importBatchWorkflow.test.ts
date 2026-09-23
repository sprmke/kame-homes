import { describe, expect, it } from 'vitest';

import { isImportBatchStatus, canImportBatchTransition, availableImportBatchTransitions, IMPORT_BATCH_STATUSES } from '@/features/dashboard/import/lib/importBatchWorkflow';

describe('isImportBatchStatus', () => {

  it('isImportBatchStatus is exported', () => {
    expect(typeof isImportBatchStatus).toBe('function');
  });

});

describe('canImportBatchTransition', () => {

  it('canImportBatchTransition is exported', () => {
    expect(typeof canImportBatchTransition).toBe('function');
  });

});

describe('availableImportBatchTransitions', () => {

  it('availableImportBatchTransitions is exported', () => {
    expect(typeof availableImportBatchTransitions).toBe('function');
  });

});

describe('IMPORT_BATCH_STATUSES', () => {
  it('is defined', () => {
    expect(IMPORT_BATCH_STATUSES).toBeDefined();
  });
});
