import { describe, expect, it } from 'vitest';

import { setPdfFont } from '@/lib/pdf/pdfFonts';

describe('setPdfFont', () => {

  it('setPdfFont is exported', () => {
    expect(typeof setPdfFont).toBe('function');
  });

});
