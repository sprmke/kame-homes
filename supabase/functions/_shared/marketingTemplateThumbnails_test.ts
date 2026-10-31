import { assertEquals, assert } from 'jsr:@std/assert@1';

import {
  copyTemplateThumbnail,
  splitThumbnail,
  templateThumbnailPath,
  uploadTemplateThumbnail,
} from './marketingTemplateThumbnails.ts';
import type { SupabaseClient } from './supabaseJs.ts';

const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

Deno.test('splitThumbnail strips the embedded image and returns it', () => {
  const { designJson, dataUrl } = splitThumbnail({ a: 1, thumbnailDataUrl: JPEG });
  assertEquals(designJson, { a: 1 });
  assertEquals(dataUrl, JPEG);
});

Deno.test('splitThumbnail returns the same object when there is nothing to strip', () => {
  const input = { a: 1 };
  assert(splitThumbnail(input).designJson === input);
  // A non-data value is dropped but not uploaded.
  assertEquals(splitThumbnail({ thumbnailDataUrl: 'https://x' }), { designJson: {}, dataUrl: null });
});

Deno.test('templateThumbnailPath stays under the property marketing-thumbs folder', () => {
  const path = templateThumbnailPath('prop-1', 'tpl-1', '.jpg');
  assert(path.startsWith('prop-1/marketing-thumbs/tpl-1-'));
  assert(path.endsWith('.jpg'));
});

Deno.test('uploadTemplateThumbnail rejects non-images and oversize payloads without uploading', async () => {
  let uploads = 0;
  const sb = {
    storage: { from: () => ({ upload: () => { uploads += 1; return Promise.resolve({ error: null }); } }) },
  } as unknown as SupabaseClient;
  assertEquals(
    await uploadTemplateThumbnail(sb, 'p', 't', 'data:image/jpeg;base64,aGVsbG8gd29ybGQgdGhpcyBpcyBub3Q='),
    null
  );
  const big = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(0xff, 0xd8, 0xff) + 'x'.repeat(700 * 1024));
  assertEquals(await uploadTemplateThumbnail(sb, 'p', 't', big), null);
  assertEquals(uploads, 0);
  const path = await uploadTemplateThumbnail(sb, 'p', 't', JPEG);
  assert(path?.startsWith('p/marketing-thumbs/t-') && path.endsWith('.jpg'));
  assertEquals(uploads, 1);
});

Deno.test('copyTemplateThumbnail copies within the property and keeps the extension', async () => {
  const calls: Array<[string, string]> = [];
  const sb = {
    storage: {
      from: () => ({
        copy: (from: string, to: string) => {
          calls.push([from, to]);
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as unknown as SupabaseClient;
  const path = await copyTemplateThumbnail(sb, 'prop-1', 'new-id', 'prop-1/marketing-thumbs/a-1.webp');
  assert(path?.startsWith('prop-1/marketing-thumbs/new-id-'));
  assert(path?.endsWith('.webp'));
  assertEquals(calls.length, 1);
});

Deno.test('copyTemplateThumbnail refuses paths from another property', async () => {
  const sb = { storage: { from: () => ({ copy: () => Promise.resolve({ error: null }) }) } } as unknown as SupabaseClient;
  assertEquals(await copyTemplateThumbnail(sb, 'prop-1', 'id', 'prop-2/marketing-thumbs/a.jpg'), null);
  assertEquals(await copyTemplateThumbnail(sb, 'prop-1', 'id', null), null);
});
