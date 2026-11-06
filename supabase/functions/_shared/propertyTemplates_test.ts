/**
 * Property templates — retired Parking Request template.
 * Run: deno test supabase/functions/_shared/propertyTemplates_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getBuiltinPropertyTemplate,
  isBuiltinPropertyTemplateKey,
  listBuiltinPropertyTemplates,
} from './propertyTemplates.ts';

Deno.test('retired Parking Request template is gone from the builtin list', () => {
  const keys = listBuiltinPropertyTemplates().map((t) => t.key);
  assertEquals(keys.includes('email-parking-request' as never), false);
  assertEquals(getBuiltinPropertyTemplate('email-parking-request'), undefined);
  assertEquals(isBuiltinPropertyTemplateKey('email-parking-request'), false);
});

Deno.test('live email templates are still listed', () => {
  const keys = new Set(listBuiltinPropertyTemplates().map((t) => t.key));
  for (const key of [
    'email-gaf-request',
    'email-pet-request',
    'email-new-booking-request',
    'email-booking-acknowledgement',
    'email-ready-for-checkin',
    'email-sd-refund-form-request',
  ]) {
    assertEquals(keys.has(key as never), true, `${key} should still exist`);
  }
});
