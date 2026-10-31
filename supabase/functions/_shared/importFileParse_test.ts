import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { parseImportCsvText } from './importFileParse.ts';

Deno.test('parseImportCsvText parses header and rows', () => {
  const parsed = parseImportCsvText('name,email\nMaria,maria@example.com\n');
  assertEquals(parsed.headers, ['name', 'email']);
  assertEquals(parsed.rows.length, 1);
  assertEquals(parsed.rows[0].name, 'Maria');
});
