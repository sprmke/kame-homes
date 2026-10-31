import { assertEquals } from 'jsr:@std/assert@1';

import {
  chatTemplateHtmlToPlainText,
  isValidChatTemplateKey,
  renderChatTemplateHtml,
} from './chatTemplateMessage.ts';

Deno.test('isValidChatTemplateKey accepts built-in and custom keys', () => {
  assertEquals(isValidChatTemplateKey('house-rules'), true);
  assertEquals(isValidChatTemplateKey('custom-4f0b1c2d'), true);
  assertEquals(isValidChatTemplateKey('email-gaf-request'), true);
  assertEquals(isValidChatTemplateKey('House Rules'), false);
  assertEquals(isValidChatTemplateKey('../secret'), false);
});

Deno.test('renderChatTemplateHtml fills known tokens and drops unknown ones', () => {
  const html = renderChatTemplateHtml(
    '<p>Hi {{guest_name}}, {{check_in_date}} {{unknown_token}}</p><p></p>',
    { guest_name: 'Ana', check_in_date: '2026-11-02' }
  );
  assertEquals(html, '<p>Hi Ana, 2026-11-02 </p>');
});

Deno.test('chatTemplateHtmlToPlainText keeps links readable', () => {
  const text = chatTemplateHtmlToPlainText(
    '<p>Check the <a href="https://example.com/guide">guide</a>.</p><ul><li>One</li><li>Two &amp; three</li></ul>'
  );
  assertEquals(text.includes('guide https://example.com/guide'), true);
  assertEquals(text.includes('One'), true);
  assertEquals(text.includes('Two & three'), true);
  assertEquals(text.includes('<'), false);
});

Deno.test('chatTemplateHtmlToPlainText collapses blank lines', () => {
  const text = chatTemplateHtmlToPlainText('<p>One</p><p></p><p></p><p>Two</p>');
  assertEquals(text, 'One\n\nTwo');
});
