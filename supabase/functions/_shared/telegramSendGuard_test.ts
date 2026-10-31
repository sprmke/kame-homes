/**
 * Regression: every host-facing Telegram sendMessage site must respect
 * `notifications.telegram.delivery` via `telegramDeliveryUnavailable()`.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.224.0/path/mod.ts';

const ROOT = new URL('.', import.meta.url).pathname;
const SHARED = join(ROOT);

/** Files that call Telegram sendMessage for host notifications (not getMe/getUpdates probes). */
const SEND_MESSAGE_FILES = [
  'propertyTelegramCredentials.ts',
  'telegramAdmin.ts',
  'telegramStaff.ts',
  'telegramMarketing.ts',
  'telegramParking.ts',
  'parkingBroadcast.ts',
] as const;

const EXEMPT_URL_ONLY = [
  'systemHealth/probes.ts',
  'telegramDiscoverChats.ts',
  'telegramGlobalBotToken.ts',
];

Deno.test('telegram sendMessage sites guard delivery availability', async () => {
  for (const file of SEND_MESSAGE_FILES) {
    const path = join(SHARED, file);
    const text = await Deno.readTextFile(path);
    assertEquals(
      text.includes('telegramDeliveryUnavailable'),
      true,
      `${file} must call telegramDeliveryUnavailable() before sendMessage`
    );
    assertEquals(
      text.includes('/sendMessage'),
      true,
      `${file} expected to contain sendMessage URL`
    );
  }

  for (const rel of EXEMPT_URL_ONLY) {
    const path = join(SHARED, rel);
    const text = await Deno.readTextFile(path);
    if (text.includes('/sendMessage')) {
      throw new Error(`${rel} uses sendMessage but is not in SEND_MESSAGE_FILES — update the test`);
    }
  }
});
