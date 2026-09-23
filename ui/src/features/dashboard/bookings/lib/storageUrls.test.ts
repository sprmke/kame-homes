import { describe, expect, it } from 'vitest';

import { normalizeStoragePublicUrl, withStorageUrlCacheBust, parseStorageUrl, isStorageObjectNotFoundError, PRIVATE_STORAGE_BUCKETS } from '@/features/dashboard/bookings/lib/storageUrls';

describe('normalizeStoragePublicUrl', () => {

  it('normalizeStoragePublicUrl is exported', () => {
    expect(typeof normalizeStoragePublicUrl).toBe('function');
  });

});

describe('withStorageUrlCacheBust', () => {

  it('withStorageUrlCacheBust is exported', () => {
    expect(typeof withStorageUrlCacheBust).toBe('function');
  });

});

describe('parseStorageUrl', () => {

  it('parseStorageUrl is exported', () => {
    expect(typeof parseStorageUrl).toBe('function');
  });

});

describe('isStorageObjectNotFoundError', () => {

  it('isStorageObjectNotFoundError is exported', () => {
    expect(typeof isStorageObjectNotFoundError).toBe('function');
  });

});

describe('PRIVATE_STORAGE_BUCKETS', () => {
  it('is defined', () => {
    expect(PRIVATE_STORAGE_BUCKETS).toBeDefined();
  });
});
