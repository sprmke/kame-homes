import { describe, expect, it } from 'vitest';

import { setPropertySettingsIssueSections, clearPropertySettingsIssueSections, subscribePropertySettingsIssues, getPropertySettingsIssueSections, hasPropertySettingsIssues } from '@/features/dashboard/org/lib/propertySettingsIssuesStore';

describe('setPropertySettingsIssueSections', () => {

  it('setPropertySettingsIssueSections is exported', () => {
    expect(typeof setPropertySettingsIssueSections).toBe('function');
  });

});

describe('clearPropertySettingsIssueSections', () => {

  it('clearPropertySettingsIssueSections is exported', () => {
    expect(typeof clearPropertySettingsIssueSections).toBe('function');
  });

});

describe('subscribePropertySettingsIssues', () => {

  it('subscribePropertySettingsIssues is exported', () => {
    expect(typeof subscribePropertySettingsIssues).toBe('function');
  });

});

describe('getPropertySettingsIssueSections', () => {

  it('getPropertySettingsIssueSections is exported', () => {
    expect(typeof getPropertySettingsIssueSections).toBe('function');
  });

});

describe('hasPropertySettingsIssues', () => {

  it('hasPropertySettingsIssues is exported', () => {
    expect(typeof hasPropertySettingsIssues).toBe('function');
  });

});
