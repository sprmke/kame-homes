import { describe, expect, it } from 'vitest';

import { setOrgSettingsIssueSections, clearOrgSettingsIssueSections, subscribeOrgSettingsIssues, getOrgSettingsIssueSections, hasOrgSettingsIssues } from '@/features/dashboard/org/lib/orgSettingsIssuesStore';

describe('setOrgSettingsIssueSections', () => {

  it('setOrgSettingsIssueSections is exported', () => {
    expect(typeof setOrgSettingsIssueSections).toBe('function');
  });

});

describe('clearOrgSettingsIssueSections', () => {

  it('clearOrgSettingsIssueSections is exported', () => {
    expect(typeof clearOrgSettingsIssueSections).toBe('function');
  });

});

describe('subscribeOrgSettingsIssues', () => {

  it('subscribeOrgSettingsIssues is exported', () => {
    expect(typeof subscribeOrgSettingsIssues).toBe('function');
  });

});

describe('getOrgSettingsIssueSections', () => {

  it('getOrgSettingsIssueSections is exported', () => {
    expect(typeof getOrgSettingsIssueSections).toBe('function');
  });

});

describe('hasOrgSettingsIssues', () => {

  it('hasOrgSettingsIssues is exported', () => {
    expect(typeof hasOrgSettingsIssues).toBe('function');
  });

});
