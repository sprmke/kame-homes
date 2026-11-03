import { assertEquals } from 'jsr:@std/assert@1';

import { readSampleId } from './marketingGenerationJobs.ts';

Deno.test('readSampleId accepts kebab-case example ids', () => {
  assertEquals(readSampleId('photo-golden-balcony'), 'photo-golden-balcony');
  assertEquals(readSampleId('clip-walkthrough'), 'clip-walkthrough');
});

Deno.test('readSampleId drops malformed values instead of failing the request', () => {
  assertEquals(readSampleId(undefined), null);
  assertEquals(readSampleId(null), null);
  assertEquals(readSampleId(12), null);
  assertEquals(readSampleId(''), null);
  assertEquals(readSampleId('Photo Golden'), null);
  assertEquals(readSampleId('photo--double'), null);
  assertEquals(readSampleId('-leading'), null);
  assertEquals(readSampleId('x'.repeat(65)), null);
  assertEquals(readSampleId('<script>'), null);
});
