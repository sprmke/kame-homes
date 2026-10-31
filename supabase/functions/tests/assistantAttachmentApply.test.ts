import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  assertAssistantAttachmentPathAllowed,
  assistantAttachmentFolderPrefix,
} from '../_shared/assistantAttachmentApply.ts';

Deno.test('assistantAttachmentFolderPrefix builds org/user/conversation folder', () => {
  assertEquals(
    assistantAttachmentFolderPrefix({
      organizationId: 'org-1',
      userId: 'user-1',
      conversationId: 'conv-1',
    }),
    'org-1/user-1/conv-1/'
  );
});

Deno.test('assertAssistantAttachmentPathAllowed accepts same-conversation paths', () => {
  const path = assertAssistantAttachmentPathAllowed('org-1/user-1/conv-1/uuid-approved.pdf', {
    organizationId: 'org-1',
    userId: 'user-1',
    conversationId: 'conv-1',
  });
  assertEquals(path, 'org-1/user-1/conv-1/uuid-approved.pdf');
});

Deno.test('assertAssistantAttachmentPathAllowed rejects cross-conversation paths', () => {
  assertThrows(
    () =>
      assertAssistantAttachmentPathAllowed('org-1/user-1/other-conv/file.pdf', {
        organizationId: 'org-1',
        userId: 'user-1',
        conversationId: 'conv-1',
      }),
    Error,
    'Attachment is not from this conversation'
  );
});

Deno.test('assertAssistantAttachmentPathAllowed rejects path traversal', () => {
  assertThrows(
    () =>
      assertAssistantAttachmentPathAllowed('org-1/user-1/conv-1/../user-2/secret.pdf', {
        organizationId: 'org-1',
        userId: 'user-1',
        conversationId: 'conv-1',
      }),
    Error,
    'Invalid attachment path'
  );
});

Deno.test('resolveAssistantAttachmentPath strips bucket prefix', async () => {
  const { resolveAssistantAttachmentPath } = await import('../_shared/assistantAttachmentApply.ts');
  const path = await resolveAssistantAttachmentPath(
    'ai-assistant-attachments/org-1/user-1/conv-1/uuid-approved.pdf',
    {
      organizationId: 'org-1',
      userId: 'user-1',
      conversationId: 'conv-1',
    }
  );
  assertEquals(path, 'org-1/user-1/conv-1/uuid-approved.pdf');
});
