const DEFAULT_GAF_UNIT_OWNER = 'Arianna Perez';
const DEFAULT_GAF_TOWER_AND_UNIT_NUMBER = 'Monaco 2604';
const DEFAULT_GAF_GUESTS_ONSITE_CONTACT_PERSON = 'Arianna Perez';
const DEFAULT_GAF_OWNER_CONTACT_NUMBER = '0962 541 2941';

export type GafDetailsValues = {
  gafUnitOwner: string;
  gafTowerAndUnitNumber: string;
  gafGuestsOnsiteContactPerson: string;
  gafOwnerContactNumber: string;
};

export const DEFAULT_GAF_DETAILS: GafDetailsValues = {
  gafUnitOwner: DEFAULT_GAF_UNIT_OWNER,
  gafTowerAndUnitNumber: DEFAULT_GAF_TOWER_AND_UNIT_NUMBER,
  gafGuestsOnsiteContactPerson: DEFAULT_GAF_GUESTS_ONSITE_CONTACT_PERSON,
  gafOwnerContactNumber: DEFAULT_GAF_OWNER_CONTACT_NUMBER,
};

export function gafDetailsToFormSubmitFields(details: GafDetailsValues): {
  unitOwner: string;
  towerAndUnitNumber: string;
  ownerOnsiteContactPerson: string;
  ownerContactNumber: string;
} {
  return {
    unitOwner: details.gafUnitOwner,
    towerAndUnitNumber: details.gafTowerAndUnitNumber,
    ownerOnsiteContactPerson: details.gafGuestsOnsiteContactPerson,
    ownerContactNumber: details.gafOwnerContactNumber,
  };
}

export function gafDetailsToPdfFormFields(details: GafDetailsValues): Record<string, string> {
  return gafDetailsToFormSubmitFields(details);
}
