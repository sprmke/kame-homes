import { describe, expect, it } from 'vitest';

import { normalizeAttachmentInput, inboxAttachmentPreviews } from '@/features/dashboard/inbox/lib/inboxMessageAttachments';

describe('normalizeAttachmentInput', () => {

  it('normalizeAttachmentInput is exported', () => {
    expect(typeof normalizeAttachmentInput).toBe('function');
  });

});

describe('inboxAttachmentPreviews', () => {

  it('inboxAttachmentPreviews is exported', () => {
    expect(typeof inboxAttachmentPreviews).toBe('function');
  });

});
