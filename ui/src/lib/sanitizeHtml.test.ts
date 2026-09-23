import { describe, expect, it } from 'vitest';

import { sanitizeRichTextHtml, sanitizeEmailSnapshotHtml } from '@/lib/sanitizeHtml';

describe('sanitizeRichTextHtml', () => {

  it('sanitizeRichTextHtml is exported', () => {
    expect(typeof sanitizeRichTextHtml).toBe('function');
  });

});

describe('sanitizeEmailSnapshotHtml', () => {

  it('sanitizeEmailSnapshotHtml is exported', () => {
    expect(typeof sanitizeEmailSnapshotHtml).toBe('function');
  });

});
