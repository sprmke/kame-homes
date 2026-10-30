/**
 * Per-property Telegram bot token + chat id (encrypted in DB).
 */

import { createServiceClient } from './orgAuth.ts';
import { trimOrEmpty } from './stringUtils.ts';
import { fetchTelegramJson } from './telegramApi.ts';
import { decryptPropertySecret } from './propertySecretCrypto.ts';

export type TelegramChannel =
  'marketing' | 'staff' | 'admin' | 'finance' | 'maintenance' | 'parking' | 'chat';

const TABLE_BY_CHANNEL: Record<TelegramChannel, string> = {
  marketing: 'telegram_marketing_settings',
  staff: 'telegram_staff_settings',
  admin: 'telegram_admin_settings',
  finance: 'telegram_finance_settings',
  maintenance: 'telegram_maintenance_settings',
  parking: 'telegram_parking_settings',
  chat: 'telegram_chat_settings',
};

export type TelegramAssetScopeRef = {
  propertyId?: string | null;
  parkingId?: string | null;
};

export type ResolveTelegramCreds =
  | { ok: true; token: string; chatId: string; source: 'db' }
  | {
      ok: false;
      error: string;
      code: 'missing_token' | 'missing_chat_id' | 'invalid_chat_id';
    };

export type TelegramEnvVerifyResult = {
  credentials: {
    tokenConfigured: boolean;
    chatIdConfigured: boolean;
    normalizedChatId?: string;
    normalizeError?: string;
    rawLeadingCodePoint?: number;
    normalizedStartsWithAsciiMinus?: boolean;
  };
  getMe: { ok: boolean; username?: string; error?: string };
  getChat: {
    ok: boolean;
    type?: string;
    title?: string;
    username?: string;
    error?: string;
  };
};

/** Same normalization as telegramMarketing.ts */
export function normalizeTelegramChatId(
  raw: string
): { ok: true; chatId: string } | { ok: false; error: string } {
  let s = raw.trim();
  if (!s) return { ok: false, error: 'empty chat id' };
  if (s.charCodeAt(0) === 8722) {
    s = '-' + s.slice(1);
  }
  if (/^-?\d+$/.test(s)) return { ok: true, chatId: s };
  if (/^@[\w\d_]{5,}$/.test(s)) return { ok: true, chatId: s };
  return { ok: false, error: `invalid chat id format: ${s.slice(0, 32)}` };
}

async function loadEncryptedCreds(
  channel: TelegramChannel,
  scope?: TelegramAssetScopeRef | string | null
): Promise<{ token: string | null; chatId: string | null }> {
  const resolved: TelegramAssetScopeRef =
    typeof scope === 'string' || scope == null
      ? { propertyId: typeof scope === 'string' ? scope : null }
      : scope;

  if (!resolved.propertyId && !resolved.parkingId) {
    return { token: null, chatId: null };
  }

  const table = TABLE_BY_CHANNEL[channel];
  let query = createServiceClient().from(table).select('bot_token_encrypted, chat_id_encrypted');

  if (channel === 'parking') {
    if (!resolved.parkingId) {
      return { token: null, chatId: null };
    }
    query = query.eq('parking_id', resolved.parkingId);
  } else if (resolved.parkingId) {
    query = query.eq('parking_id', resolved.parkingId);
  } else {
    query = query.eq('property_id', resolved.propertyId!);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn(`[telegram/${channel}] load creds:`, error.message);
    }
    return { token: null, chatId: null };
  }

  const token = await decryptPropertySecret(data.bot_token_encrypted as string | null);
  const chatId = await decryptPropertySecret(data.chat_id_encrypted as string | null);
  return { token, chatId };
}

export async function resolvePropertyTelegramCredentials(
  channel: TelegramChannel,
  scope?: TelegramAssetScopeRef | string | null
): Promise<ResolveTelegramCreds> {
  const fromDb = await loadEncryptedCreds(channel, scope);
  const token = fromDb.token ?? '';
  const rawChat = fromDb.chatId ?? '';
  const assetLabel = typeof scope === 'object' && scope?.parkingId ? 'parking' : 'property';

  if (!token) {
    return {
      ok: false,
      error: `Telegram bot token not configured for this ${assetLabel}`,
      code: 'missing_token',
    };
  }
  if (!rawChat) {
    return {
      ok: false,
      error: `Telegram chat ID not configured for this ${assetLabel}`,
      code: 'missing_chat_id',
    };
  }

  const n = normalizeTelegramChatId(rawChat);
  if (!n.ok) {
    return { ok: false, error: n.error, code: 'invalid_chat_id' };
  }

  return { ok: true, token, chatId: n.chatId, source: 'db' };
}

export type TelegramCredentialsStatus = {
  tokenConfigured: boolean;
  chatIdConfigured: boolean;
  tokenSource: 'db' | 'none';
  chatIdSource: 'db' | 'none';
  secretsEncryptionConfigured: boolean;
};

/** Admin settings GET/PATCH — includes decrypted values for the settings form. */
export type TelegramCredentialsAdminStatus = TelegramCredentialsStatus & {
  botToken: string | null;
  chatId: string | null;
};

export async function getPropertyTelegramCredentialsStatus(
  channel: TelegramChannel,
  scope?: TelegramAssetScopeRef | string | null
): Promise<TelegramCredentialsStatus> {
  const fromDb = await loadEncryptedCreds(channel, scope);

  return {
    tokenConfigured: !!fromDb.token,
    chatIdConfigured: !!fromDb.chatId,
    tokenSource: fromDb.token ? 'db' : 'none',
    chatIdSource: fromDb.chatId ? 'db' : 'none',
    secretsEncryptionConfigured: !!Deno.env.get('GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY')?.trim(),
  };
}

export async function getPropertyTelegramCredentialsAdminStatus(
  channel: TelegramChannel,
  scope?: TelegramAssetScopeRef | string | null
): Promise<TelegramCredentialsAdminStatus> {
  const status = await getPropertyTelegramCredentialsStatus(channel, scope);
  const fromDb = await loadEncryptedCreds(channel, scope);
  return {
    ...status,
    botToken: fromDb.token,
    chatId: fromDb.chatId,
  };
}

export async function verifyPropertyTelegramChannel(
  channel: TelegramChannel,
  scope?: TelegramAssetScopeRef | string | null,
  overrides?: { botToken?: string; chatId?: string }
): Promise<TelegramEnvVerifyResult> {
  const status = await getPropertyTelegramCredentialsStatus(channel, scope);
  const fromDb = await loadEncryptedCreds(channel, scope);
  const assetLabel = typeof scope === 'object' && scope?.parkingId ? 'parking' : 'property';

  const token = (overrides?.botToken ?? '').trim() || (fromDb.token ?? '');
  const rawChat = (overrides?.chatId ?? '').trim() || (fromDb.chatId ?? '');

  let normalizedChatId: string | undefined;
  let normalizeError: string | undefined;

  if (!token) {
    normalizeError = `Telegram bot token not configured for this ${assetLabel}`;
  } else if (!rawChat) {
    normalizeError = `Telegram chat ID not configured for this ${assetLabel}`;
  } else {
    const n = normalizeTelegramChatId(rawChat);
    if (!n.ok) {
      normalizeError = n.error;
    } else {
      normalizedChatId = n.chatId;
    }
  }

  const credentials = {
    tokenConfigured: status.tokenConfigured || Boolean(overrides?.botToken?.trim()),
    chatIdConfigured: status.chatIdConfigured || Boolean(overrides?.chatId?.trim()),
    normalizedChatId,
    normalizeError,
    rawLeadingCodePoint: normalizedChatId?.startsWith('-') ? 45 : undefined,
    normalizedStartsWithAsciiMinus: normalizedChatId ? normalizedChatId.startsWith('-') : undefined,
  };

  if (!token || !normalizedChatId) {
    const err = normalizeError ?? 'Telegram credentials incomplete';
    return {
      credentials,
      getMe: { ok: false, error: err },
      getChat: { ok: false, error: err },
    };
  }

  const meUrl = `https://api.telegram.org/bot${token}/getMe`;
  const meFetched = await fetchTelegramJson<{
    ok?: boolean;
    result?: { username?: string };
    description?: string;
  }>(meUrl);

  const chatUrl = `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(
    normalizedChatId
  )}`;
  const chatFetched = await fetchTelegramJson<{
    ok?: boolean;
    result?: { type?: string; title?: string; username?: string };
    description?: string;
  }>(chatUrl);

  const meJson = meFetched.ok ? meFetched.json : null;
  const meRes = meFetched.ok ? meFetched.response : null;
  const chatJson = chatFetched.ok ? chatFetched.json : null;
  const chatRes = chatFetched.ok ? chatFetched.response : null;

  return {
    credentials,
    getMe: {
      ok: !!meJson?.ok,
      username: meJson?.result?.username,
      error: !meFetched.ok
        ? meFetched.error
        : meJson?.ok
          ? undefined
          : String(meJson?.description ?? meRes?.statusText ?? 'getMe failed'),
    },
    getChat: {
      ok: !!chatJson?.ok,
      type: chatJson?.result?.type,
      title: chatJson?.result?.title,
      username: chatJson?.result?.username,
      error: !chatFetched.ok
        ? chatFetched.error
        : chatJson?.ok
          ? undefined
          : String(chatJson?.description ?? chatRes?.statusText ?? 'getChat failed'),
    },
  };
}

export async function encryptTelegramCredentialFields(input: {
  botToken?: string | null;
  chatId?: string | null;
}): Promise<{ bot_token_encrypted?: string | null; chat_id_encrypted?: string | null }> {
  const { encryptPropertySecret } = await import('./propertySecretCrypto.ts');
  const patch: {
    bot_token_encrypted?: string | null;
    chat_id_encrypted?: string | null;
  } = {};

  if (input.botToken !== undefined) {
    const t = trimOrEmpty(input.botToken);
    patch.bot_token_encrypted = t ? await encryptPropertySecret(t) : null;
  }
  if (input.chatId !== undefined) {
    const c = trimOrEmpty(input.chatId);
    patch.chat_id_encrypted = c ? await encryptPropertySecret(c) : null;
  }
  return patch;
}

export async function sendPropertyTelegramMessage(
  channel: TelegramChannel,
  text: string,
  scope?: TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const { telegramDeliveryUnavailable } = await import('./featureAvailability.ts');
  if (await telegramDeliveryUnavailable()) {
    return { ok: false, error: 'feature_unavailable' };
  }
  const creds = await resolvePropertyTelegramCredentials(channel, scope);
  if (!creds.ok) {
    if (creds.code === 'missing_token' || creds.code === 'missing_chat_id') {
      return { ok: false, error: 'missing_credentials' };
    }
    return { ok: false, error: creds.error };
  }
  const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: creds.chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    const desc = json?.description ?? res.statusText;
    return { ok: false, error: String(desc) };
  }
  return { ok: true };
}
