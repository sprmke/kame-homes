import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildCalendarExportUrls,
  CALENDAR_EXPORT_ICS_PATH,
  resolvePublicExportOrigin,
} from './calendarExportUrls.ts';

Deno.test('buildCalendarExportUrls: path ends with .ics before query (Airbnb requirement)', () => {
  const urls = buildCalendarExportUrls(
    'https://fworvijbrwpyngycotbz.supabase.co',
    'demo-property',
    'tok_abc'
  );
  const pathAndQuery = urls.airbnb.replace('https://fworvijbrwpyngycotbz.supabase.co', '');
  assertStringIncludes(pathAndQuery, CALENDAR_EXPORT_ICS_PATH);
  assertEquals(pathAndQuery.includes('.ics?'), true);
  assertEquals(urls.airbnb.includes('property=demo-property'), true);
  assertEquals(urls.airbnb.includes('token=tok_abc'), true);
  assertEquals(urls.airbnb.includes('as=airbnb'), true);
  assertEquals(urls.all.includes('as='), false);
});

Deno.test('resolvePublicExportOrigin: upgrades supabase.co http from req or env', () => {
  const req = new Request(
    'http://fworvijbrwpyngycotbz.supabase.co/functions/v1/calendar-sync-settings'
  );
  assertEquals(
    resolvePublicExportOrigin(req, 'http://fworvijbrwpyngycotbz.supabase.co'),
    'https://fworvijbrwpyngycotbz.supabase.co'
  );
  assertEquals(
    resolvePublicExportOrigin(req, undefined),
    'https://fworvijbrwpyngycotbz.supabase.co'
  );
});

Deno.test('resolvePublicExportOrigin: keeps local http for local Supabase', () => {
  const req = new Request('http://127.0.0.1:54321/functions/v1/calendar-sync-settings');
  assertEquals(resolvePublicExportOrigin(req, 'http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
});
