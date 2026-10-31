import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  classifyGenerationReferenceMime,
  extensionForVisualMime,
  marketingUploadStoragePath,
  sniffVisualMime,
} from './marketingGenerationStorage.ts';

Deno.test('marketingUploadStoragePath: builds the dedicated, un-pruned prefix', () => {
  const path = marketingUploadStoragePath('prop-1', 'uuid-abc', '.jpg');
  assertEquals(path, 'marketing-uploads/prop-1/uuid-abc.jpg');
});

Deno.test('marketingUploadStoragePath: normalizes an extension without a leading dot', () => {
  assertEquals(
    marketingUploadStoragePath('prop-1', 'uuid-abc', 'png'),
    'marketing-uploads/prop-1/uuid-abc.png'
  );
});

Deno.test('marketingUploadStoragePath: strips unsafe characters out of the file key', () => {
  const path = marketingUploadStoragePath('prop-1', '../../etc/passwd', '.jpg');
  assertMatch(path, /^marketing-uploads\/prop-1\/[a-zA-Z0-9_-]+\.jpg$/);
});

Deno.test('marketingUploadStoragePath: two properties never collide', () => {
  const a = marketingUploadStoragePath('prop-a', 'same-uuid', '.jpg');
  const b = marketingUploadStoragePath('prop-b', 'same-uuid', '.jpg');
  assertEquals(a === b, false);
});

Deno.test('upload-marketing-asset accepts only sniffed image bytes', () => {
  // PNG magic bytes.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const sniffed = sniffVisualMime(png);
  assertEquals(sniffed, 'image/png');
  assertEquals(classifyGenerationReferenceMime(sniffed!), 'image');
  assertEquals(extensionForVisualMime(sniffed!), '.png');
});

Deno.test('upload-marketing-asset rejects sniffed video bytes', () => {
  // Matroska/WebM magic bytes — a video container, not an image.
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const sniffed = sniffVisualMime(webm);
  assertEquals(sniffed, 'video/webm');
  assertEquals(classifyGenerationReferenceMime(sniffed!), 'video');
});
