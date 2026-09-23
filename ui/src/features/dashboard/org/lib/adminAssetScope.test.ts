import { describe, expect, it } from 'vitest';

import { useAdminAssetScope, assetScopeQuery, scopedAssetPath, scopedAssetFunctionsUrl, assetScopeKey } from '@/features/dashboard/org/lib/adminAssetScope';

describe('useAdminAssetScope', () => {

  it('useAdminAssetScope is exported', () => {
    expect(typeof useAdminAssetScope).toBe('function');
  });

});

describe('assetScopeQuery', () => {

  it('assetScopeQuery is exported', () => {
    expect(typeof assetScopeQuery).toBe('function');
  });

});

describe('scopedAssetPath', () => {

  it('scopedAssetPath is exported', () => {
    expect(typeof scopedAssetPath).toBe('function');
  });

});

describe('scopedAssetFunctionsUrl', () => {

  it('scopedAssetFunctionsUrl is exported', () => {
    expect(typeof scopedAssetFunctionsUrl).toBe('function');
  });

});

describe('assetScopeKey', () => {

  it('assetScopeKey is exported', () => {
    expect(typeof assetScopeKey).toBe('function');
  });

});
