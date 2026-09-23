import { describe, expect, it } from 'vitest';

import { beginPdfTheme, setPdfFill, setPdfDraw, setPdfText, drawCard, PDF_FONT, PDF_LAYOUT, PDF_TYPE } from '@/lib/pdf/pdfTheme';

describe('beginPdfTheme', () => {

  it('beginPdfTheme is exported', () => {
    expect(typeof beginPdfTheme).toBe('function');
  });

});

describe('setPdfFill', () => {

  it('setPdfFill is exported', () => {
    expect(typeof setPdfFill).toBe('function');
  });

});

describe('setPdfDraw', () => {

  it('setPdfDraw is exported', () => {
    expect(typeof setPdfDraw).toBe('function');
  });

});

describe('setPdfText', () => {

  it('setPdfText is exported', () => {
    expect(typeof setPdfText).toBe('function');
  });

});

describe('drawCard', () => {

  it('drawCard is exported', () => {
    expect(typeof drawCard).toBe('function');
  });

});

describe('PDF_FONT', () => {
  it('is defined', () => {
    expect(PDF_FONT).toBeDefined();
  });
});

describe('PDF_LAYOUT', () => {
  it('is defined', () => {
    expect(PDF_LAYOUT).toBeDefined();
  });
});

describe('PDF_TYPE', () => {
  it('is defined', () => {
    expect(PDF_TYPE).toBeDefined();
  });
});
