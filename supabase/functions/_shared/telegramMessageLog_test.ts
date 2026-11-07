import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { buildTelegramLogRow, TELEGRAM_MESSAGE_MAX_CHARS } from './telegramMessageLog.ts';
import { normalizeTelegramScope } from './telegramScope.ts';

Deno.test('normalizeTelegramScope - accepts a property id shorthand', () => {
  assertEquals(normalizeTelegramScope('prop-1'), { propertyId: 'prop-1', parkingId: null });
  assertEquals(normalizeTelegramScope({ parkingId: 'park-1' }), {
    propertyId: null,
    parkingId: 'park-1',
  });
  assertEquals(normalizeTelegramScope(null), { propertyId: null, parkingId: null });
});

Deno.test('buildTelegramLogRow - stores the sent text and status', () => {
  const row = buildTelegramLogRow({
    scope: { propertyId: 'prop-1' },
    module: 'chat',
    text: 'New guest message',
    ok: true,
  });

  assertEquals(row, {
    property_id: 'prop-1',
    parking_id: null,
    module: 'chat',
    message_text: 'New guest message',
    status: 'sent',
    error_message: null,
  });
});

Deno.test('buildTelegramLogRow - keeps the failure reason', () => {
  const row = buildTelegramLogRow({
    scope: { parkingId: 'park-1' },
    module: 'parking',
    text: 'Reservation request',
    ok: false,
    error: 'Bad Request: chat not found',
  });

  assertEquals(row?.status, 'failed');
  assertEquals(row?.error_message, 'Bad Request: chat not found');
  assertEquals(row?.parking_id, 'park-1');
});

Deno.test('buildTelegramLogRow - truncates at the Telegram limit', () => {
  const row = buildTelegramLogRow({
    scope: { propertyId: 'prop-1' },
    module: 'marketing',
    text: 'x'.repeat(TELEGRAM_MESSAGE_MAX_CHARS + 50),
    ok: true,
  });
  assertEquals(row?.message_text.length, TELEGRAM_MESSAGE_MAX_CHARS);
});

Deno.test('buildTelegramLogRow - skips rows with no scope or no text', () => {
  assertEquals(
    buildTelegramLogRow({ scope: null, module: 'chat', text: 'hi', ok: true }),
    null
  );
  assertEquals(
    buildTelegramLogRow({ scope: { propertyId: 'p' }, module: 'chat', text: '  ', ok: true }),
    null
  );
});
