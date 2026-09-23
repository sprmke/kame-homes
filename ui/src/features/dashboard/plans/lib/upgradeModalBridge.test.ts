import { describe, expect, it } from 'vitest';

import { registerUpgradeModalOpener, openUpgradeModalFromBridge, hasUpgradeModalOpener } from '@/features/dashboard/plans/lib/upgradeModalBridge';

describe('registerUpgradeModalOpener', () => {

  it('registerUpgradeModalOpener is exported', () => {
    expect(typeof registerUpgradeModalOpener).toBe('function');
  });

});

describe('openUpgradeModalFromBridge', () => {

  it('openUpgradeModalFromBridge is exported', () => {
    expect(typeof openUpgradeModalFromBridge).toBe('function');
  });

});

describe('hasUpgradeModalOpener', () => {

  it('hasUpgradeModalOpener is exported', () => {
    expect(typeof hasUpgradeModalOpener).toBe('function');
  });

});
