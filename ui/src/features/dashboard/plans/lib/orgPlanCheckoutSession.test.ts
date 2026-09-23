import { describe, expect, it } from 'vitest';

import { markOrgPlanCheckoutSession, readOrgPlanCheckoutSession, clearOrgPlanCheckoutSession, isOrgPlanCheckoutWatchExpired, writeOrgPlanUpgradeCelebration, consumeOrgPlanUpgradeCelebration, ORG_PLAN_CHECKOUT_WATCH_MS } from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';

describe('markOrgPlanCheckoutSession', () => {

  it('markOrgPlanCheckoutSession is exported', () => {
    expect(typeof markOrgPlanCheckoutSession).toBe('function');
  });

});

describe('readOrgPlanCheckoutSession', () => {

  it('readOrgPlanCheckoutSession is exported', () => {
    expect(typeof readOrgPlanCheckoutSession).toBe('function');
  });

});

describe('clearOrgPlanCheckoutSession', () => {

  it('clearOrgPlanCheckoutSession is exported', () => {
    expect(typeof clearOrgPlanCheckoutSession).toBe('function');
  });

});

describe('isOrgPlanCheckoutWatchExpired', () => {

  it('isOrgPlanCheckoutWatchExpired is exported', () => {
    expect(typeof isOrgPlanCheckoutWatchExpired).toBe('function');
  });

});

describe('writeOrgPlanUpgradeCelebration', () => {

  it('writeOrgPlanUpgradeCelebration is exported', () => {
    expect(typeof writeOrgPlanUpgradeCelebration).toBe('function');
  });

});

describe('consumeOrgPlanUpgradeCelebration', () => {

  it('consumeOrgPlanUpgradeCelebration is exported', () => {
    expect(typeof consumeOrgPlanUpgradeCelebration).toBe('function');
  });

});

describe('ORG_PLAN_CHECKOUT_WATCH_MS', () => {
  it('is defined', () => {
    expect(ORG_PLAN_CHECKOUT_WATCH_MS).toBeDefined();
  });
});
