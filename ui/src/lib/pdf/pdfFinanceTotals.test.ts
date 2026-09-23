import { describe, expect, it } from 'vitest';

import { computeStayTableTotals, stayRowDisplayNet, formatStayHostNetCell, formatStayHostNetFoot, stayHostNetFootTotal, stayHostNetFootIsEstimate } from '@/lib/pdf/pdfFinanceTotals';

describe('computeStayTableTotals', () => {

  it('computeStayTableTotals is exported', () => {
    expect(typeof computeStayTableTotals).toBe('function');
  });

});

describe('stayRowDisplayNet', () => {

  it('stayRowDisplayNet is exported', () => {
    expect(typeof stayRowDisplayNet).toBe('function');
  });

});

describe('formatStayHostNetCell', () => {

  it('formatStayHostNetCell is exported', () => {
    expect(typeof formatStayHostNetCell).toBe('function');
  });

});

describe('formatStayHostNetFoot', () => {

  it('formatStayHostNetFoot is exported', () => {
    expect(typeof formatStayHostNetFoot).toBe('function');
  });

});

describe('stayHostNetFootTotal', () => {

  it('stayHostNetFootTotal is exported', () => {
    expect(typeof stayHostNetFootTotal).toBe('function');
  });

});

describe('stayHostNetFootIsEstimate', () => {

  it('stayHostNetFootIsEstimate is exported', () => {
    expect(typeof stayHostNetFootIsEstimate).toBe('function');
  });

});
