import { describe, expect, it } from 'vitest';

import { displayHelpGuideGroup, sanitizeHelpTitle, displayHelpModule, displayHelpArticleTitle, sanitizeHelpBody, helpModuleSortRank, HELP_GUIDE_GROUPS, HELP_MODULE_ORDER } from '@/features/dashboard/help-support/lib/helpContentDisplay';

describe('displayHelpGuideGroup', () => {

  it('displayHelpGuideGroup is exported', () => {
    expect(typeof displayHelpGuideGroup).toBe('function');
  });

});

describe('sanitizeHelpTitle', () => {

  it('sanitizeHelpTitle is exported', () => {
    expect(typeof sanitizeHelpTitle).toBe('function');
  });

});

describe('displayHelpModule', () => {

  it('displayHelpModule is exported', () => {
    expect(typeof displayHelpModule).toBe('function');
  });

});

describe('displayHelpArticleTitle', () => {

  it('displayHelpArticleTitle is exported', () => {
    expect(typeof displayHelpArticleTitle).toBe('function');
  });

});

describe('sanitizeHelpBody', () => {

  it('sanitizeHelpBody is exported', () => {
    expect(typeof sanitizeHelpBody).toBe('function');
  });

});

describe('helpModuleSortRank', () => {

  it('helpModuleSortRank is exported', () => {
    expect(typeof helpModuleSortRank).toBe('function');
  });

});

describe('HELP_GUIDE_GROUPS', () => {
  it('is defined', () => {
    expect(HELP_GUIDE_GROUPS).toBeDefined();
  });
});

describe('HELP_MODULE_ORDER', () => {
  it('is defined', () => {
    expect(HELP_MODULE_ORDER).toBeDefined();
  });
});
