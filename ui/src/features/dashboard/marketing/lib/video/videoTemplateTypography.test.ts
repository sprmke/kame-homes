import { describe, expect, it } from 'vitest';

import { resolveVideoFontPairing, resolveVideoTemplateLook, resolveVideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

describe('resolveVideoFontPairing', () => {

  it('resolveVideoFontPairing is exported', () => {
    expect(typeof resolveVideoFontPairing).toBe('function');
  });

});

describe('resolveVideoTemplateLook', () => {

  it('resolveVideoTemplateLook is exported', () => {
    expect(typeof resolveVideoTemplateLook).toBe('function');
  });

});

describe('resolveVideoTypographyContext', () => {

  it('resolveVideoTypographyContext is exported', () => {
    expect(typeof resolveVideoTypographyContext).toBe('function');
  });

});
