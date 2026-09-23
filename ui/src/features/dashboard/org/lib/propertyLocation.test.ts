import { describe, expect, it } from 'vitest';

import { isAzureNorthResidence, isPropertyLocationEmpty, azureNorthDefaultLocationFields, applyResidenceLocationDefaultsToDraft, buildGoogleMapsUrl, formatPlaceDisplayAddress, parseGoogleAddressComponents, locationFromPlace, locationFromGeocoderResult, readNullableLatitude, readNullableLongitude, clonePropertyLocationFields, propertyLocationFieldsEqual, isPropertyLocationManageValid, AZURE_NORTH_LOCATION_ADDRESS, AZURE_NORTH_DEFAULT_COORDS, DEFAULT_PROPERTY_MAP_CENTER, PROPERTY_LOCATION_MANAGE_FIELD_IDS } from '@/features/dashboard/org/lib/propertyLocation';

describe('isAzureNorthResidence', () => {

  it('isAzureNorthResidence is exported', () => {
    expect(typeof isAzureNorthResidence).toBe('function');
  });

});

describe('isPropertyLocationEmpty', () => {

  it('isPropertyLocationEmpty is exported', () => {
    expect(typeof isPropertyLocationEmpty).toBe('function');
  });

});

describe('azureNorthDefaultLocationFields', () => {

  it('azureNorthDefaultLocationFields is exported', () => {
    expect(typeof azureNorthDefaultLocationFields).toBe('function');
  });

});

describe('applyResidenceLocationDefaultsToDraft', () => {

  it('applyResidenceLocationDefaultsToDraft is exported', () => {
    expect(typeof applyResidenceLocationDefaultsToDraft).toBe('function');
  });

});

describe('buildGoogleMapsUrl', () => {

  it('buildGoogleMapsUrl is exported', () => {
    expect(typeof buildGoogleMapsUrl).toBe('function');
  });

});

describe('formatPlaceDisplayAddress', () => {

  it('formatPlaceDisplayAddress is exported', () => {
    expect(typeof formatPlaceDisplayAddress).toBe('function');
  });

});

describe('parseGoogleAddressComponents', () => {

  it('parseGoogleAddressComponents is exported', () => {
    expect(typeof parseGoogleAddressComponents).toBe('function');
  });

});

describe('locationFromPlace', () => {

  it('locationFromPlace is exported', () => {
    expect(typeof locationFromPlace).toBe('function');
  });

});

describe('locationFromGeocoderResult', () => {

  it('locationFromGeocoderResult is exported', () => {
    expect(typeof locationFromGeocoderResult).toBe('function');
  });

});

describe('readNullableLatitude', () => {

  it('readNullableLatitude is exported', () => {
    expect(typeof readNullableLatitude).toBe('function');
  });

});

describe('readNullableLongitude', () => {

  it('readNullableLongitude is exported', () => {
    expect(typeof readNullableLongitude).toBe('function');
  });

});

describe('clonePropertyLocationFields', () => {

  it('clonePropertyLocationFields is exported', () => {
    expect(typeof clonePropertyLocationFields).toBe('function');
  });

});

describe('propertyLocationFieldsEqual', () => {

  it('propertyLocationFieldsEqual is exported', () => {
    expect(typeof propertyLocationFieldsEqual).toBe('function');
  });

});

describe('isPropertyLocationManageValid', () => {

  it('isPropertyLocationManageValid is exported', () => {
    expect(typeof isPropertyLocationManageValid).toBe('function');
  });

});

describe('AZURE_NORTH_LOCATION_ADDRESS', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_LOCATION_ADDRESS).toBeDefined();
  });
});

describe('AZURE_NORTH_DEFAULT_COORDS', () => {
  it('is defined', () => {
    expect(AZURE_NORTH_DEFAULT_COORDS).toBeDefined();
  });
});

describe('DEFAULT_PROPERTY_MAP_CENTER', () => {
  it('is defined', () => {
    expect(DEFAULT_PROPERTY_MAP_CENTER).toBeDefined();
  });
});

describe('PROPERTY_LOCATION_MANAGE_FIELD_IDS', () => {
  it('is defined', () => {
    expect(PROPERTY_LOCATION_MANAGE_FIELD_IDS).toBeDefined();
  });
});

