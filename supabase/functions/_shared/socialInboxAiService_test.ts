import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { resolveInboxAiFeature } from './socialInboxAiService.ts';

Deno.test('resolveInboxAiFeature — host Suggest on a web DM uses inbox_suggest', () => {
  assertEquals(resolveInboxAiFeature({ platform: 'web', conversationType: 'dm' }), 'inbox_suggest');
});

Deno.test('resolveInboxAiFeature — unattended auto-send uses inbox_auto_reply', () => {
  assertEquals(
    resolveInboxAiFeature({ platform: 'web', conversationType: 'dm', actorType: 'system' }),
    'inbox_auto_reply'
  );
  assertEquals(
    resolveInboxAiFeature({
      platform: 'facebook',
      conversationType: 'dm',
      actorType: 'system',
    }),
    'inbox_auto_reply'
  );
});

Deno.test('resolveInboxAiFeature — legacy web_chat type still meters as auto-reply', () => {
  assertEquals(
    resolveInboxAiFeature({ platform: 'web', conversationType: 'web_chat' }),
    'inbox_auto_reply'
  );
});
