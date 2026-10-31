import { describe, expect, it } from 'vitest';

import { readChatTemplateSnapshot } from '@/components/chat/chatTemplateSnapshot';

const valid = {
  templateKey: 'house-rules',
  name: 'House Rules',
  category: 'standard',
  html: '<p>Quiet hours start at 10 PM.</p>',
  sectionImageUrl: null,
  propertyId: 'property-1',
};

describe('readChatTemplateSnapshot', () => {
  it('reads a valid snapshot', () => {
    expect(readChatTemplateSnapshot(valid)).toEqual(valid);
  });

  it('rejects rows that predate template messages', () => {
    expect(readChatTemplateSnapshot(null)).toBeNull();
    expect(readChatTemplateSnapshot(undefined)).toBeNull();
    expect(readChatTemplateSnapshot({})).toBeNull();
  });

  it('rejects a missing body, name or property', () => {
    expect(readChatTemplateSnapshot({ ...valid, html: '   ' })).toBeNull();
    expect(readChatTemplateSnapshot({ ...valid, name: '' })).toBeNull();
    expect(readChatTemplateSnapshot({ ...valid, propertyId: '' })).toBeNull();
  });

  it('normalizes an unknown category to standard only when explicit', () => {
    expect(readChatTemplateSnapshot({ ...valid, category: 'email' })).toBeNull();
    expect(readChatTemplateSnapshot({ ...valid, category: 'custom' })?.category).toBe('custom');
  });

  it('treats an empty section image as null', () => {
    expect(readChatTemplateSnapshot({ ...valid, sectionImageUrl: '  ' })?.sectionImageUrl).toBeNull();
  });
});
