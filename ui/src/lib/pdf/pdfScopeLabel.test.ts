import { describe, expect, it } from 'vitest';

import { pdfPropertyScope, pdfParkingScope, pdfScopeFooterLabel } from '@/lib/pdf/pdfScopeLabel';

describe('pdfPropertyScope', () => {

  it('pdfPropertyScope is exported', () => {
    expect(typeof pdfPropertyScope).toBe('function');
  });

});

describe('pdfParkingScope', () => {

  it('pdfParkingScope is exported', () => {
    expect(typeof pdfParkingScope).toBe('function');
  });

});

describe('pdfScopeFooterLabel', () => {

  it('pdfScopeFooterLabel is exported', () => {
    expect(typeof pdfScopeFooterLabel).toBe('function');
  });

});
