import { describe, expect, it } from 'vitest';

import { isAssistantImageMime, fileToBase64Payload, validateAssistantFiles, ASSISTANT_ATTACHMENT_MAX_BYTES, ASSISTANT_ATTACHMENT_MAX_COUNT, ASSISTANT_IMAGE_ACCEPT, ASSISTANT_FILE_ACCEPT } from '@/features/dashboard/ai-assistant/lib/chatAttachments';

describe('isAssistantImageMime', () => {

  it('isAssistantImageMime is exported', () => {
    expect(typeof isAssistantImageMime).toBe('function');
  });

});

describe('fileToBase64Payload', () => {

  it('fileToBase64Payload is exported', () => {
    expect(typeof fileToBase64Payload).toBe('function');
  });

});

describe('validateAssistantFiles', () => {

  it('validateAssistantFiles is exported', () => {
    expect(typeof validateAssistantFiles).toBe('function');
  });

});

describe('ASSISTANT_ATTACHMENT_MAX_BYTES', () => {
  it('is defined', () => {
    expect(ASSISTANT_ATTACHMENT_MAX_BYTES).toBeDefined();
  });
});

describe('ASSISTANT_ATTACHMENT_MAX_COUNT', () => {
  it('is defined', () => {
    expect(ASSISTANT_ATTACHMENT_MAX_COUNT).toBeDefined();
  });
});

describe('ASSISTANT_IMAGE_ACCEPT', () => {
  it('is defined', () => {
    expect(ASSISTANT_IMAGE_ACCEPT).toBeDefined();
  });
});

describe('ASSISTANT_FILE_ACCEPT', () => {
  it('is defined', () => {
    expect(ASSISTANT_FILE_ACCEPT).toBeDefined();
  });
});
