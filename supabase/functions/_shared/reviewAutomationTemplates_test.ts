import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  applyReviewTemplateTokens,
  autoReviewDueAt,
  DEFAULT_AUTO_REVIEW_TEMPLATES,
  guestFirstName,
  isAutoReviewDue,
  normalizeAutomationTemplates,
  pickRandomTemplate,
} from './reviewAutomationTemplates.ts';

Deno.test('guestFirstName uses the first token or there', () => {
  assertEquals(guestFirstName('Maria Santos'), 'Maria');
  assertEquals(guestFirstName('  '), 'there');
  assertEquals(guestFirstName(null), 'there');
});

Deno.test('applyReviewTemplateTokens replaces both tokens', () => {
  const text = applyReviewTemplateTokens('{{guest_first_name}} stayed at {{property_name}}.', {
    guestFirstName: 'Maria',
    propertyName: 'Solea',
  });
  assertEquals(text, 'Maria stayed at Solea.');
});

Deno.test('normalizeAutomationTemplates drops blanks and caps length', () => {
  assertEquals(normalizeAutomationTemplates(['  a  ', '', 1, 'b']), ['a', 'b']);
});

Deno.test('pickRandomTemplate skips empty strings', () => {
  assertEquals(
    pickRandomTemplate(['', 'hello'], () => 0),
    'hello'
  );
  assertEquals(pickRandomTemplate(['   ']), null);
});

Deno.test('isAutoReviewDue waits delay days from opens_at', () => {
  const opens = '2026-10-01T00:00:00.000Z';
  const due = autoReviewDueAt(opens, 3);
  assertEquals(isAutoReviewDue(opens, 3, new Date(due - 1)), false);
  assertEquals(isAutoReviewDue(opens, 3, new Date(due)), true);
});

Deno.test('default auto-review pool has at least three templates', () => {
  assertEquals(DEFAULT_AUTO_REVIEW_TEMPLATES.length >= 3, true);
});
