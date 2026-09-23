import { describe, expect, it } from 'vitest';

import { faqModuleForCategory, faqModuleById, faqAdminScopeForFaq, faqMatchesAdminScope, FAQ_MODULE_IDS, COMMON_FAQ_LIMIT } from '@/features/dashboard/help-support/lib/helpFaqModules';

describe('faqModuleForCategory', () => {

  it('faqModuleForCategory is exported', () => {
    expect(typeof faqModuleForCategory).toBe('function');
  });

});

describe('faqModuleById', () => {

  it('faqModuleById is exported', () => {
    expect(typeof faqModuleById).toBe('function');
  });

});

describe('faqAdminScopeForFaq', () => {

  it('faqAdminScopeForFaq is exported', () => {
    expect(typeof faqAdminScopeForFaq).toBe('function');
  });

});

describe('faqMatchesAdminScope', () => {

  it('faqMatchesAdminScope is exported', () => {
    expect(typeof faqMatchesAdminScope).toBe('function');
  });

});

describe('FAQ_MODULE_IDS', () => {
  it('is defined', () => {
    expect(FAQ_MODULE_IDS).toBeDefined();
  });
});

describe('COMMON_FAQ_LIMIT', () => {
  it('is defined', () => {
    expect(COMMON_FAQ_LIMIT).toBeDefined();
  });
});
