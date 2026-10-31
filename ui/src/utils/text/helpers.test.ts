import { describe, expect, it } from 'vitest';

import { validateImageFile, validateName } from '@/utils/text/helpers';

describe('validateName', () => {
  it('requires two words with min length on first and last', () => {
    expect(validateName('Maria Santos')).toBe(true);
    expect(validateName('Maria')).toBe(false);
    expect(validateName('M S')).toBe(false);
    expect(validateName('Maria A Santos')).toBe(true);
  });
});

describe('validateImageFile', () => {
  it('rejects missing file', () => {
    expect(validateImageFile(null).valid).toBe(false);
  });

  it('accepts jpeg/png/heic', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it('rejects unsupported mime', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateImageFile(file).valid).toBe(false);
  });
});
