import { describe, expect, it } from 'vitest';

import { isSeededOrgTemplateName, findOrgTemplateIdByName, SEEDED_ORG_TEMPLATE_NAMES, SEEDED_ORG_TEMPLATE_NAME_SET } from '@/features/dashboard/team/lib/orgTeamTemplates';

describe('isSeededOrgTemplateName', () => {

  it('isSeededOrgTemplateName is exported', () => {
    expect(typeof isSeededOrgTemplateName).toBe('function');
  });

});

describe('findOrgTemplateIdByName', () => {

  it('findOrgTemplateIdByName is exported', () => {
    expect(typeof findOrgTemplateIdByName).toBe('function');
  });

});

describe('SEEDED_ORG_TEMPLATE_NAMES', () => {
  it('is defined', () => {
    expect(SEEDED_ORG_TEMPLATE_NAMES).toBeDefined();
  });
});

describe('SEEDED_ORG_TEMPLATE_NAME_SET', () => {
  it('is defined', () => {
    expect(SEEDED_ORG_TEMPLATE_NAME_SET).toBeDefined();
  });
});
