import { assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { uploadInboxChatAssetFromBytes } from './inboxChatAssetUpload.ts';

const base = { organizationId: 'org', conversationId: 'conv', fileName: 'x' };

Deno.test('uploadInboxChatAssetFromBytes rejects HTML declared as PNG before upload', async () => {
  const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
  await assertRejects(
    () => uploadInboxChatAssetFromBytes({ ...base, bytes: html, mimeType: 'image/png' }),
    Error,
    'File type not recognized'
  );
});

Deno.test('uploadInboxChatAssetFromBytes rejects PNG bytes declared as PDF', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  await assertRejects(
    () => uploadInboxChatAssetFromBytes({ ...base, bytes: png, mimeType: 'application/pdf' }),
    Error,
    'File content is image/png, not application/pdf'
  );
});

Deno.test('uploadInboxChatAssetFromBytes rejects disallowed types', async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
  await assertRejects(
    () => uploadInboxChatAssetFromBytes({ ...base, bytes: svg, mimeType: 'image/svg+xml' }),
    Error,
    'File must be JPEG, PNG, WebP, HEIC, or PDF'
  );
});
