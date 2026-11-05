import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  LIBRARY_DEFAULT_LIMIT,
  LIBRARY_MAX_LIMIT,
  MAX_BULK_IDS,
  decodeLibraryCursor,
  duplicateName,
  encodeLibraryCursor,
  isTemplateRef,
  normalizeItemName,
  pageLibraryRows,
  parseGroupIdField,
  parseIdList,
  parseLibraryQuery,
  parseTemplateRefField,
  patchActivityFields,
  recentlyDeletedCutoff,
  sameInstant,
  serializeLibraryRow,
  type LibraryRpcRow,
} from './marketingTemplateLibrary.ts';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const anyTheme = (value: unknown) => typeof value === 'string' && value.length > 0;

Deno.test('isTemplateRef accepts preset and saved-template refs only', () => {
  assert(isTemplateRef('preset:quiet-morning'));
  assert(isTemplateRef(`tpl:${ID_A}`));
  assert(!isTemplateRef('preset:'));
  assert(!isTemplateRef('preset:Bad Id'));
  assert(!isTemplateRef('tpl:not-a-uuid'));
  assert(!isTemplateRef('blank'));
  assert(!isTemplateRef(42));
});

Deno.test('parseTemplateRefField distinguishes missing, clear, valid and invalid', () => {
  assertEquals(parseTemplateRefField(undefined), undefined);
  assertEquals(parseTemplateRefField(null), null);
  assertEquals(parseTemplateRefField(''), null);
  assertEquals(parseTemplateRefField('preset:promo-500-off'), 'preset:promo-500-off');
  assert(parseTemplateRefField('nope') instanceof Error);
});

Deno.test('parseGroupIdField lowercases UUIDs and rejects other values', () => {
  assertEquals(parseGroupIdField(ID_A.toUpperCase()), ID_A);
  assertEquals(parseGroupIdField(null), null);
  assert(parseGroupIdField('x') instanceof Error);
});

Deno.test('normalizeItemName collapses spaces, trims and caps length', () => {
  assertEquals(normalizeItemName('  Summer   promo  '), 'Summer promo');
  assertEquals(normalizeItemName('   '), null);
  assertEquals(normalizeItemName(5), null);
  assertEquals(normalizeItemName('a'.repeat(300))?.length, 120);
});

Deno.test('duplicateName counts copies instead of stacking suffixes', () => {
  assertEquals(duplicateName('Promo'), 'Promo (copy)');
  assertEquals(duplicateName('Promo (copy)'), 'Promo (copy 2)');
  assertEquals(duplicateName('Promo (copy 2)'), 'Promo (copy 3)');
  assertEquals(duplicateName('  '), 'Untitled (copy)');
});

Deno.test('library cursor round-trips and rejects tampering', () => {
  const encoded = encodeLibraryCursor({ key: '2026-10-19T10:00:00.123456', id: ID_A });
  assertEquals(decodeLibraryCursor(encoded), { key: '2026-10-19T10:00:00.123456', id: ID_A });
  assertEquals(decodeLibraryCursor('garbage!!'), null);
  assertEquals(decodeLibraryCursor(null), null);
  assertEquals(decodeLibraryCursor(btoa(JSON.stringify(['k', 'not-uuid']))), null);
});

Deno.test('library cursor keeps non-ASCII name keys', () => {
  const encoded = encodeLibraryCursor({ key: '₱500 off', id: ID_B });
  assertEquals(decodeLibraryCursor(encoded)?.key, '₱500 off');
});

Deno.test('parseLibraryQuery applies defaults and validates input', () => {
  const ok = parseLibraryQuery(new URLSearchParams('content_type=video'), anyTheme);
  assert(typeof ok !== 'string');
  assertEquals(ok.kind, 'design');
  assertEquals(ok.sort, 'updated');
  assertEquals(ok.limit, LIBRARY_DEFAULT_LIMIT);
  assertEquals(ok.deleted, false);
  assertEquals(ok.themeKey, null);

  const full = parseLibraryQuery(
    new URLSearchParams(
      'content_type=design&kind=template&theme_key=property-colors&q=  summer  promo &size=instagram-story&sort=name&limit=500&deleted=1'
    ),
    anyTheme
  );
  assert(typeof full !== 'string');
  assertEquals(full.kind, 'template');
  assertEquals(full.query, 'summer promo');
  assertEquals(full.aspect, 'instagram-story');
  assertEquals(full.sort, 'name');
  assertEquals(full.limit, LIBRARY_MAX_LIMIT);
  assertEquals(full.deleted, true);

  assertEquals(typeof parseLibraryQuery(new URLSearchParams(''), anyTheme), 'string');
  assertEquals(
    typeof parseLibraryQuery(new URLSearchParams('content_type=video&kind=folder'), anyTheme),
    'string'
  );
  assertEquals(
    typeof parseLibraryQuery(new URLSearchParams('content_type=video&theme_key=x'), () => false),
    'string'
  );
  const badSort = parseLibraryQuery(
    new URLSearchParams('content_type=video&sort=random&size=../x'),
    anyTheme
  );
  assert(typeof badSort !== 'string');
  assertEquals(badSort.sort, 'updated');
  assertEquals(badSort.aspect, null);
});

function row(overrides: Partial<LibraryRpcRow>): LibraryRpcRow {
  return {
    id: ID_A,
    name: 'Promo',
    kind: 'design',
    content_type: 'design',
    platform: 'instagram',
    aspect_preset: 'instagram-post',
    theme_key: 'property-colors',
    group_id: null,
    source_template_id: 'preset:promo-500-off',
    thumbnail_path: 'p/marketing-thumbs/a.jpg',
    ai_generated: null,
    is_collage: false,
    theme_hash: 'abc',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    deleted_at: null,
    group_size: null,
    group_members: null,
    sort_key: '2026-10-02T00:00:00.000000',
    ...overrides,
  };
}

Deno.test('serializeLibraryRow maps columns and fills group defaults', () => {
  const out = serializeLibraryRow(row({}), (path) => (path ? `https://cdn/${path}` : null));
  assertEquals(out.thumbnailUrl, 'https://cdn/p/marketing-thumbs/a.jpg');
  assertEquals(out.aiGenerated, false);
  assertEquals(out.groupSize, 1);
  assertEquals(out.groupMembers, []);
  assertEquals(out.sourceTemplateId, 'preset:promo-500-off');
  assertEquals(out.previewStyles, null);
});

Deno.test('serializeLibraryRow passes calendar preview styles only without a thumbnail', () => {
  const styles = { name: 'x' };
  const noThumb = serializeLibraryRow(
    row({ content_type: 'calendar', thumbnail_path: null, preview_styles: styles }),
    () => null
  );
  assertEquals(noThumb.previewStyles, styles);
  const withThumb = serializeLibraryRow(
    row({ content_type: 'calendar', preview_styles: styles }),
    () => 'u'
  );
  assertEquals(withThumb.previewStyles, null);
});

Deno.test('pageLibraryRows trims the look-ahead row and builds the next cursor', () => {
  const rows = [row({ id: ID_A, sort_key: 'b' }), row({ id: ID_B, sort_key: 'a' })];
  const full = pageLibraryRows(rows, 2);
  assertEquals(full.nextCursor, null);
  assertEquals(full.rows.length, 2);

  const paged = pageLibraryRows(rows, 1);
  assertEquals(paged.rows.length, 1);
  assertEquals(decodeLibraryCursor(paged.nextCursor), { key: 'b', id: ID_A });
});

Deno.test('parseIdList accepts one id, many ids, or the query id; rejects bad input', () => {
  assertEquals(parseIdList({ id: ID_A }), [ID_A]);
  assertEquals(parseIdList({ ids: [ID_A, ID_A.toUpperCase(), ID_B] }), [ID_A, ID_B]);
  assertEquals(parseIdList({}, ID_B), [ID_B]);
  assertEquals(typeof parseIdList({}), 'string');
  assertEquals(typeof parseIdList({ ids: ['x'] }), 'string');
  assertEquals(
    typeof parseIdList({ ids: Array.from({ length: MAX_BULK_IDS + 1 }, () => ID_A) }),
    'string'
  );
});

Deno.test('sameInstant compares instants across formats', () => {
  assert(sameInstant('2026-10-19T10:00:00.123456+00:00', '2026-10-19T10:00:00.123Z'));
  assert(!sameInstant('2026-10-19T10:00:00.123Z', '2026-10-19T10:00:00.124Z'));
  assert(!sameInstant(null, '2026-10-19T10:00:00Z'));
  assert(!sameInstant('nope', 'nope'));
});

Deno.test('patchActivityFields ignores autosave content fields', () => {
  assertEquals(
    patchActivityFields({ design_json: {}, aspect_preset: 'x', platform: 'y', theme_key: 'z' }),
    []
  );
  assertEquals(patchActivityFields({ name: 'New', design_json: {} }), ['name']);
});

Deno.test('recentlyDeletedCutoff is 30 days back', () => {
  assertEquals(recentlyDeletedCutoff(new Date('2026-10-31T00:00:00Z')), '2026-10-01T00:00:00.000Z');
});
