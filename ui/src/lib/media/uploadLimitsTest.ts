import { describe, expect, it } from 'vitest';

import {
  formatMaxBytesError,
  formatUploadLimit,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  validateUploadFile,
} from './uploadLimits';
import {
  formatMaxBytesError as edgeFormatMaxBytesError,
  UPLOAD_MAX_BYTES as EDGE_UPLOAD_MAX_BYTES,
} from '../../../../supabase/functions/_shared/uploadLimits';

function fakeFile(size: number): File {
  return { size } as File;
}

describe('uploadLimits', () => {
  it('rejects files over the ceiling with the canonical message', () => {
    const res = validateUploadFile(fakeFile(UPLOAD_MAX_BYTES.image + 1), 'image');
    expect(res).toEqual({ ok: false, message: 'File must be 10 MB or smaller' });
  });

  it('accepts files at exactly the ceiling', () => {
    expect(validateUploadFile(fakeFile(UPLOAD_MAX_BYTES.document), 'document')).toEqual({
      ok: true,
    });
  });

  it('formats ceilings', () => {
    expect(formatUploadLimit('video')).toBe('50 MB');
    expect(formatMaxBytesError(5 * 1024 * 1024)).toBe('File must be 5 MB or smaller');
  });

  it('has an accept string for every kind', () => {
    for (const kind of Object.keys(UPLOAD_MAX_BYTES) as Array<keyof typeof UPLOAD_MAX_BYTES>) {
      if (kind === 'pdf') continue;
      expect(UPLOAD_ACCEPT[kind as keyof typeof UPLOAD_ACCEPT]).toBeTruthy();
    }
  });

  it('stays in parity with the edge mirror (numbers + error string)', () => {
    expect(UPLOAD_MAX_BYTES).toEqual(EDGE_UPLOAD_MAX_BYTES);
    for (const bytes of Object.values(UPLOAD_MAX_BYTES)) {
      expect(formatMaxBytesError(bytes)).toBe(edgeFormatMaxBytesError(bytes));
    }
  });
});
