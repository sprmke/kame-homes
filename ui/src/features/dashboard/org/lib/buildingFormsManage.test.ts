import { describe, expect, it } from 'vitest';

import {
  BUILDING_FORMS_MANAGE_FIELD_IDS,
  buildingFormsFieldsEqual,
  cloneBuildingFormsFields,
  validateBuildingFormsManage,
} from '@/features/dashboard/org/lib/buildingFormsManage';

const sample = {
  gafUnitOwner: 'Michael Manlulu',
  gafTowerAndUnitNumber: 'Monaco 2612',
  gafGuestsOnsiteContactPerson: 'Michael Manlulu',
  gafOwnerContactNumber: '0917 123 4567',
};

describe('buildingFormsManage', () => {
  it('clones and compares trimmed field values', () => {
    const cloned = cloneBuildingFormsFields(sample);
    expect(cloned).toEqual(sample);
    expect(cloned).not.toBe(sample);
    expect(
      buildingFormsFieldsEqual(sample, {
        ...sample,
        gafUnitOwner: '  Michael Manlulu  ',
      })
    ).toBe(true);
    expect(
      buildingFormsFieldsEqual(sample, {
        ...sample,
        gafUnitOwner: 'Other Person',
      })
    ).toBe(false);
  });

  it('exposes manage field ids for interaction marking', () => {
    expect(BUILDING_FORMS_MANAGE_FIELD_IDS).toContain('gaf-unit-owner');
    expect(BUILDING_FORMS_MANAGE_FIELD_IDS).toContain('gaf-owner-signature');
  });

  it('validateBuildingFormsManage requires signature and valid fields', () => {
    expect(validateBuildingFormsManage(sample, true)).toBeNull();
    expect(validateBuildingFormsManage(sample, false)).toBe('Upload the unit owner signature');
    expect(validateBuildingFormsManage({ ...sample, gafUnitOwner: '' }, true)).toBe(
      'Enter the unit owner name'
    );
    expect(
      validateBuildingFormsManage({ ...sample, gafOwnerContactNumber: '123' }, true)
    ).not.toBeNull();
  });
});
