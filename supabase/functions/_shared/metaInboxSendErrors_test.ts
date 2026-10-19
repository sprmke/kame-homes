import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { friendlyMetaSendError } from './metaInboxSendErrors.ts';

Deno.test('friendlyMetaSendError: expired token asks the host to reconnect', () => {
  assertEquals(
    friendlyMetaSendError(
      'Error validating access token: Session has expired on Monday. (OAuthException code 190)'
    ),
    'Meta session expired — reconnect Facebook in Channels.'
  );
});

Deno.test('friendlyMetaSendError: permission, window, rate limit and recipient errors', () => {
  assertEquals(
    friendlyMetaSendError('(#10) This page does not have permission'),
    'Missing Meta permission — reconnect the Page or complete App Review.'
  );
  assertEquals(
    friendlyMetaSendError('Message sent outside the allowed window'),
    'Messaging window expired — guest must message again before you can reply.'
  );
  assertEquals(
    friendlyMetaSendError('(#4) Application request limit reached'),
    'Meta rate limit — wait a moment and try again.'
  );
  assertEquals(
    friendlyMetaSendError('(#100) No matching user found for recipient'),
    'Invalid recipient — try syncing conversations from Channels.'
  );
});

Deno.test('friendlyMetaSendError: unknown errors pass through unchanged', () => {
  assertEquals(friendlyMetaSendError('Something else'), 'Something else');
});
