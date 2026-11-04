/**
 * Every email template must stay free of the retired product name.
 *
 * The templates are plain HTML with `{{placeholder}}` tokens, so a hardcoded
 * brand string is the one thing a runtime test can miss: the shell renders
 * fine, it just says the wrong name. This walks the whole template tree.
 *
 * Run: deno test --allow-read supabase/functions/_shared/emailBrandName_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { DEFAULT_PLATFORM_APP_NAME, resolvePlatformAppName } from './platformBrand.ts';

const TEMPLATES_DIR = new URL('./email-templates/', import.meta.url);
const RETIRED_NAME = /kame[\s_-]*homes?\b/i;

async function collectHtmlFiles(dir: URL): Promise<URL[]> {
  const files: URL[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const child = new URL(entry.name + (entry.isDirectory ? '/' : ''), dir);
    if (entry.isDirectory) {
      files.push(...(await collectHtmlFiles(child)));
    } else if (entry.isFile && entry.name.endsWith('.html')) {
      files.push(child);
    }
  }
  return files;
}

Deno.test('no email template hardcodes the retired product name', async () => {
  const files = await collectHtmlFiles(TEMPLATES_DIR);
  if (files.length === 0) throw new Error('No email templates found');

  const offenders: string[] = [];
  for (const file of files) {
    const html = await Deno.readTextFile(file);
    if (RETIRED_NAME.test(html)) offenders.push(file.pathname);
  }

  assertEquals(offenders, [], `Templates still contain the retired name: ${offenders.join(', ')}`);
});

Deno.test('the platform brand resolves to Kame Space when the env is unset or stale', () => {
  assertEquals(resolvePlatformAppName(undefined), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName(''), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName('Kame Homes'), 'Kame Space');
  assertEquals(resolvePlatformAppName('kame-homes'), 'Kame Space');
});
