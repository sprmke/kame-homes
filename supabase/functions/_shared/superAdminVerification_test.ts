import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { maskEmail, superAdminActionLabel } from './superAdminVerification.ts';

Deno.test('maskEmail hides local part', () => {
  assertEquals(maskEmail('admin@example.com'), 'a***@example.com');
  assertEquals(maskEmail('ab@example.com'), 'a*@example.com');
});

Deno.test('superAdminActionLabel returns gated label or fallback', () => {
  assertEquals(superAdminActionLabel('unknown_action'), 'perform a sensitive super-admin action');
  assertEquals(superAdminActionLabel(null), 'perform a sensitive super-admin action');
});
