import { assertEquals } from 'jsr:@std/assert@1';

import {
  decodeSessionCursor,
  encodeSessionCursor,
  pageSessionRows,
  parsePostVersionInputs,
  parseSessionListQuery,
  refineParentError,
  serializeSessionRow,
  sessionTitleFromPrompt,
  type AiSessionRpcRow,
} from './marketingAiSessions.ts';

const ID = '7d4f0b2e-6c1a-4f1e-9b2a-0c3d4e5f6a7b';
const SESSION = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

Deno.test('sessionTitleFromPrompt drops the look suffix and collapses spaces', () => {
  assertEquals(
    sessionTitleFromPrompt('Balcony   at golden hour\n\nStyle: warm light', 'image'),
    'Balcony at golden hour'
  );
});

Deno.test('sessionTitleFromPrompt falls back by output', () => {
  assertEquals(sessionTitleFromPrompt('', 'post'), 'Post');
  assertEquals(sessionTitleFromPrompt('   ', 'video'), 'Clip');
  assertEquals(sessionTitleFromPrompt(undefined, 'image'), 'Photo');
});

Deno.test('sessionTitleFromPrompt cuts long prompts at a word boundary', () => {
  const title = sessionTitleFromPrompt(
    'Sunlit living room with a sea view and linen curtains moving in a soft afternoon breeze',
    'video'
  );
  assertEquals(title.length <= 60, true);
  assertEquals(title.endsWith(' '), false);
  assertEquals(title, 'Sunlit living room with a sea view and linen curtains');
});

Deno.test('session cursor round-trips and rejects junk', () => {
  const cursor = { at: '2026-10-20T03:00:00.123456+00:00', id: ID };
  assertEquals(decodeSessionCursor(encodeSessionCursor(cursor)), cursor);
  assertEquals(decodeSessionCursor('not-base64!'), null);
  assertEquals(decodeSessionCursor(encodeSessionCursor({ at: 'yesterday', id: ID })), null);
  assertEquals(decodeSessionCursor(encodeSessionCursor({ at: cursor.at, id: 'x' })), null);
});

Deno.test('parseSessionListQuery validates output and clamps limit', () => {
  assertEquals(
    parseSessionListQuery(new URLSearchParams('output=gif')),
    'output must be post, image, or video'
  );
  const parsed = parseSessionListQuery(
    new URLSearchParams('output=video&q=  sea  view &limit=500&deleted=1')
  );
  if (typeof parsed === 'string') throw new Error(parsed);
  assertEquals(parsed.output, 'video');
  assertEquals(parsed.query, 'sea view');
  assertEquals(parsed.limit, 60);
  assertEquals(parsed.deleted, true);
});

Deno.test('pageSessionRows trims the probe row and returns a cursor', () => {
  const rows = [
    { id: ID, sort_at: '2026-10-20T03:00:00Z' },
    { id: SESSION, sort_at: '2026-10-19T03:00:00Z' },
  ];
  const page = pageSessionRows(rows, 1);
  assertEquals(page.rows.length, 1);
  assertEquals(decodeSessionCursor(page.nextCursor), { at: '2026-10-20T03:00:00Z', id: ID });
  assertEquals(pageSessionRows(rows, 2).nextCursor, null);
});

Deno.test('serializeSessionRow resolves post covers from Storage paths', () => {
  const base: AiSessionRpcRow = {
    id: ID,
    output: 'post',
    title: 'Weekday promo',
    theme_key: null,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T01:00:00Z',
    deleted_at: null,
    sort_at: '2026-10-20T01:00:00Z',
    version_count: 5,
    in_flight: false,
    cover_url: null,
    cover_poster_url: null,
    cover_path: 'p/marketing-thumbs/v.jpg',
    cover_media: 'post',
    cover_aspect: 'instagram-portrait',
  };
  const out = serializeSessionRow(base, (path) => (path ? `https://cdn/${path}` : null));
  assertEquals(out.cover?.url, 'https://cdn/p/marketing-thumbs/v.jpg');
  assertEquals(out.versionCount, 5);
  assertEquals(serializeSessionRow({ ...base, cover_media: null }, () => null).cover, null);
});

Deno.test('parsePostVersionInputs checks shape, caps and URLs', () => {
  const good = {
    spec: { archetype: 'wave-duo' },
    goal: 'vibe',
    format: 'instagram-portrait',
    photoUrls: ['https://x/a.jpg'],
    previewDataUrl: 'data:image/jpeg;base64,AAAA',
  };
  const parsed = parsePostVersionInputs([good]);
  if (typeof parsed === 'string') throw new Error(parsed);
  assertEquals(parsed[0]!.photoUrls, ['https://x/a.jpg']);
  assertEquals(parsePostVersionInputs([]), 'versions is required');
  assertEquals(parsePostVersionInputs(Array(5).fill(good)), 'At most 4 versions at a time');
  assertEquals(parsePostVersionInputs([{ ...good, goal: 'party' }]), 'goal is not valid');
  assertEquals(parsePostVersionInputs([{ ...good, format: 'tiktok' }]), 'format is not valid');
  assertEquals(
    parsePostVersionInputs([{ ...good, photoUrls: ['javascript:alert(1)'] }]),
    'photoUrls must be http(s) URLs'
  );
  assertEquals(
    parsePostVersionInputs([{ ...good, spec: { blob: 'x'.repeat(20_000) } }]),
    'spec is too large'
  );
});

Deno.test('refineParentError keeps refinements inside their conversation', () => {
  const parent = {
    session_id: SESSION,
    media_type: 'image',
    job_status: 'completed',
    output_storage_path: 'p/marketing-ai/x.jpg',
  };
  assertEquals(refineParentError(parent, SESSION, 'image'), null);
  assertEquals(refineParentError(null, SESSION, 'image'), 'The version to refine was not found');
  assertEquals(
    refineParentError(parent, ID, 'image'),
    'That version belongs to another conversation'
  );
  assertEquals(
    refineParentError(parent, SESSION, 'video'),
    'That version is a different kind of media'
  );
  assertEquals(
    refineParentError({ ...parent, job_status: 'processing' }, SESSION, 'image'),
    'That photo is not finished yet'
  );
  // A clip refinement reuses the start photo, so an unfinished parent clip is fine.
  assertEquals(
    refineParentError(
      { ...parent, media_type: 'video', job_status: 'failed', output_storage_path: null },
      SESSION,
      'video'
    ),
    null
  );
});
