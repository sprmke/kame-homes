import { describe, expect, it } from 'vitest';

import { isSeededTemplateName, findTemplateIdByName, SEEDED_PROPERTY_TEMPLATE_NAMES, SEEDED_TEMPLATE_NAME_SET } from '@/features/dashboard/team/lib/propertyTeamTemplates';

describe('isSeededTemplateName', () => {

  it('isSeededTemplateName is exported', () => {
    expect(typeof isSeededTemplateName).toBe('function');
  });

});

describe('findTemplateIdByName', () => {

  it('findTemplateIdByName is exported', () => {
    expect(typeof findTemplateIdByName).toBe('function');
  });

});

describe('SEEDED_PROPERTY_TEMPLATE_NAMES', () => {
  it('is defined', () => {
    expect(SEEDED_PROPERTY_TEMPLATE_NAMES).toBeDefined();
  });
});

describe('SEEDED_TEMPLATE_NAME_SET', () => {
  it('is defined', () => {
    expect(SEEDED_TEMPLATE_NAME_SET).toBeDefined();
  });
});
