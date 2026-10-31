/**
 * Property- or parking-scoped shared Telegram bot token (Notifications global card).
 */

import { createServiceClient } from './orgAuth.ts';
import { applyPropertyOrLegacySingletonFilter } from './supabaseQuery.ts';
import {
  decryptPropertySecret,
  encryptPropertySecret,
  propertySecretsEncryptionConfigured,
} from './propertySecretCrypto.ts';
import { trimOrEmpty } from './stringUtils.ts';
import { fetchTelegramJson } from './telegramApi.ts';

export type TelegramGlobalBotAdminStatus = {
  tokenConfigured: boolean;
  botToken: string | null;
  secretsEncryptionConfigured: boolean;
};

export type TelegramBotTokenVerifyResult = {
  ok: boolean;
  username?: string;
  error?: string;
};

export async function verifyTelegramBotTokenOnly(
  rawToken: string
): Promise<TelegramBotTokenVerifyResult> {
  const token = trimOrEmpty(rawToken);
  if (!token) {
    return { ok: false, error: 'Bot token is required' };
  }

  const meUrl = `https://api.telegram.org/bot${token}/getMe`;
  const fetched = await fetchTelegramJson<{
    ok?: boolean;
    result?: { username?: string };
    description?: string;
  }>(meUrl);

  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const { response: meRes, json: meJson } = fetched;

  return {
    ok: !!meJson?.ok,
    username: meJson?.result?.username,
    error: meJson?.ok ? undefined : String(meJson?.description ?? meRes.statusText),
  };
}

async function loadEncryptedGlobalTokenFromAppSettings(propertyId: string): Promise<string | null> {
  const supabase = createServiceClient();
  let query = supabase.from('app_settings').select('telegram_global_bot_token_encrypted').limit(1);
  query = applyPropertyOrLegacySingletonFilter(query, propertyId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    if (error) console.warn('[telegram/global] load app_settings:', error.message);
    return null;
  }
  return decryptPropertySecret(data.telegram_global_bot_token_encrypted as string | null);
}

async function loadEncryptedGlobalTokenFromParkingSettings(
  parkingId: string
): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('parking_settings')
    .select('telegram_global_bot_token_encrypted')
    .eq('parking_id', parkingId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[telegram/global] load parking_settings:', error.message);
    return null;
  }
  return decryptPropertySecret(data.telegram_global_bot_token_encrypted as string | null);
}

export async function getPropertyTelegramGlobalBotAdminStatus(
  propertyId: string
): Promise<TelegramGlobalBotAdminStatus> {
  const botToken = await loadEncryptedGlobalTokenFromAppSettings(propertyId);
  return {
    tokenConfigured: !!botToken,
    botToken,
    secretsEncryptionConfigured: propertySecretsEncryptionConfigured(),
  };
}

export async function getParkingTelegramGlobalBotAdminStatus(
  parkingId: string
): Promise<TelegramGlobalBotAdminStatus> {
  const botToken = await loadEncryptedGlobalTokenFromParkingSettings(parkingId);
  return {
    tokenConfigured: !!botToken,
    botToken,
    secretsEncryptionConfigured: propertySecretsEncryptionConfigured(),
  };
}

export async function patchPropertyTelegramGlobalBotToken(
  propertyId: string,
  botToken: string | null | undefined
): Promise<TelegramGlobalBotAdminStatus> {
  if (botToken === undefined) {
    return getPropertyTelegramGlobalBotAdminStatus(propertyId);
  }

  const encrypted = trimOrEmpty(botToken)
    ? await encryptPropertySecret(trimOrEmpty(botToken))
    : null;

  const supabase = createServiceClient();
  let query = supabase.from('app_settings').update({
    telegram_global_bot_token_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  });
  query = applyPropertyOrLegacySingletonFilter(query, propertyId);
  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return getPropertyTelegramGlobalBotAdminStatus(propertyId);
}

export async function patchParkingTelegramGlobalBotToken(
  parkingId: string,
  botToken: string | null | undefined
): Promise<TelegramGlobalBotAdminStatus> {
  if (botToken === undefined) {
    return getParkingTelegramGlobalBotAdminStatus(parkingId);
  }

  const encrypted = trimOrEmpty(botToken)
    ? await encryptPropertySecret(trimOrEmpty(botToken))
    : null;

  const { error } = await createServiceClient()
    .from('parking_settings')
    .update({
      telegram_global_bot_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    })
    .eq('parking_id', parkingId);

  if (error) {
    throw new Error(error.message);
  }

  return getParkingTelegramGlobalBotAdminStatus(parkingId);
}
