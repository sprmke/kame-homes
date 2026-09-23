import { describe, expect, it } from 'vitest';

import { pdfMoney, pdfBookingDate, pdfIsoDate } from '@/lib/pdf/pdfFormatters';

describe('pdfMoney', () => {

  it('pdfMoney is exported', () => {
    expect(typeof pdfMoney).toBe('function');
  });

});

describe('pdfBookingDate', () => {

  it('pdfBookingDate is exported', () => {
    expect(typeof pdfBookingDate).toBe('function');
  });

});

describe('pdfIsoDate', () => {

  it('pdfIsoDate is exported', () => {
    expect(typeof pdfIsoDate).toBe('function');
  });

});
